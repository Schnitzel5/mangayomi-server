import { Hono } from "hono";
import type { Context } from "hono";
import type { Env, PageId } from "./types";
import { isPageId } from "./types";
import {
    buildDefaultUserId,
    buildLookups,
    clampPageLimit,
    createUser,
    deleteUserCascade,
    enrichChapter,
    enrichHistory,
    enrichTrack,
    enrichUpdate,
    ensureDefaultSettings,
    getSettings,
    getSyncStats,
    getUserByEmail,
    getUserById,
    listEntitiesPaged,
    listEntitiesPagedBrowse,
    MAX_RESPONSE_ROWS,
    parseAfterCursor,
    syncEntityListPaged,
    syncSettings,
    type EntityTable,
    type JsonObject,
    updateUser,
    updateUserPassword,
} from "./db";
import {
    getTokenFromRequest,
    hashPassword,
    isLegacyHash,
    isSecureRequest,
    isValidEmail,
    isValidPassword,
    issueAuthHeaders,
    clearAuthHeaders,
    normalizeEmail,
    verifyJwt,
    verifyPassword,
} from "./auth";
import type {
    CredentialsBody,
    HistorySyncBody,
    MangaSyncBody,
    SettingsWrapper,
    UpdateProfileBody,
    UpdateSyncBody,
} from "./types";
import { renderDashboardHtml } from "./ui";
import dashboardStyles from "../public/styles.css";

type AppEnv = { Bindings: Env };

// ---------------------------------------------------------------------------
// Rate limiter — sliding-window log, matches Rust server's actix-governor
// config: 30 requests / minute per peer IP, burst of 15.
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_BURST = 15;
const CLEANUP_INTERVAL_MS = 60_000;

const rateLimitStore = new Map<string, number[]>();
let lastCleanup = Date.now();

function cleanupStaleEntries(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [ip, timestamps] of rateLimitStore) {
        const recent = timestamps.filter((t) => t > cutoff);
        if (recent.length === 0) {
            rateLimitStore.delete(ip);
        } else {
            rateLimitStore.set(ip, recent);
        }
    }
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
    cleanupStaleEntries();
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = rateLimitStore.get(ip) ?? [];
    const recent = timestamps.filter((t) => t > cutoff);

    if (recent.length >= RATE_LIMIT_MAX) {
        const oldest = recent[0]!;
        const retryAfterMs = oldest + RATE_LIMIT_WINDOW_MS - now;
        return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
    }

    recent.push(now);
    rateLimitStore.set(ip, recent);

    // First RATE_LIMIT_BURST requests are always allowed (no delay).
    if (recent.length <= RATE_LIMIT_BURST) {
        return { allowed: true, retryAfterMs: 0 };
    }

    // After burst, enforce a token-refill delay to stay within the window.
    const delayMs = Math.ceil((RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX) * (recent.length - RATE_LIMIT_BURST));
    return { allowed: true, retryAfterMs: delayMs };
}

function extractClientIp(request: Request): string {
    return request.headers.get("CF-Connecting-IP")
        ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
        ?? "unknown";
}

function rateLimitResponse(retryAfterMs: number): Response {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return new Response("Too Many Requests", {
        status: 429,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Retry-After": String(retryAfterSec),
            "Cache-Control": "no-store",
        },
    });
}

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
    const ip = extractClientIp(c.req.raw);
    const { allowed, retryAfterMs } = checkRateLimit(ip);
    if (!allowed) {
        return rateLimitResponse(retryAfterMs);
    }
    await next();
});

const READ_ONLY_GET_ENTITIES = [
    "categories",
    "manga",
    "chapters",
    "tracks",
    "histories",
    "updates",
] as const satisfies readonly Exclude<EntityTable, "settings">[];

function plainText(message: string, status = 200, headers?: HeadersInit): Response {
    const responseHeaders = new Headers(headers ?? {});
    responseHeaders.set("Content-Type", "text/plain; charset=utf-8");
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(message, { status, headers: responseHeaders });
}

// Server-side enrichment for the read-only entity browsers. The Flutter
// client never consumes these GET endpoints, so adding derived fields is
// safe and keeps the SPA thin. Original fields are preserved.
async function enrichForBrowser(
    db: D1Database,
    table: Exclude<EntityTable, "settings">,
    userId: string,
    items: JsonObject[],
    options: { chapterMangaId?: number | null } = {},
): Promise<JsonObject[]> {
    if (items.length === 0) {
        return items;
    }
    if (table === "categories") {
        return items;
    }
    const lookups = await buildLookups(db, userId, { chapterMangaId: options.chapterMangaId });
    switch (table) {
        case "manga":
            return items.map((row) => ({ ...row }));
        case "chapters":
            return items.map((row) => enrichChapter(row, lookups, lookups.chapters.get(Number(row.id))));
        case "histories":
            return items.map((row) => enrichHistory(row, lookups));
        case "updates":
            return items.map((row) => enrichUpdate(row, lookups));
        case "tracks":
            return items.map((row) => enrichTrack(row, lookups));
        default:
            return items;
    }
}

// Per-table filter / sort parsers. Each route gets the right set of URL
// params and the right allowlist; unknown params are silently dropped by
// `listEntitiesPaged`. Booleans come in as the strings "true"/"false".
function parseChapterFilters(c: { req: { query: (k: string) => string | undefined } }): {
    filters: Array<{ path: string; value: string | number | boolean }>;
    sort: { field: string; dir: "ASC" | "DESC" } | null;
    mangaId: number | null;
} {
    const filters: Array<{ path: string; value: string | number | boolean }> = [];
    const mangaIdRaw = c.req.query("mangaId");
    const mangaIdNum = mangaIdRaw == null ? null : Number(mangaIdRaw);
    if (mangaIdNum != null && Number.isFinite(mangaIdNum)) {
        filters.push({ path: "mangaId", value: Math.trunc(mangaIdNum) });
    }
    const readRaw = c.req.query("read");
    if (readRaw === "true" || readRaw === "false") {
        filters.push({ path: "isRead", value: readRaw === "true" });
    }
    const bmRaw = c.req.query("bookmarked");
    if (bmRaw === "true" || bmRaw === "false") {
        filters.push({ path: "isBookmarked", value: bmRaw === "true" });
    }
    const sortField = c.req.query("sort");
    const sortDir = c.req.query("dir") === "desc" ? "DESC" : "ASC";
    const sort = sortField ? { field: sortField, dir: sortDir as "ASC" | "DESC" } : null;
    return { filters, sort, mangaId: mangaIdNum != null && Number.isFinite(mangaIdNum) ? Math.trunc(mangaIdNum) : null };
}

function parseMangaIdFilter(c: { req: { query: (k: string) => string | undefined } }): Array<{ path: string; value: number }> {
    const raw = c.req.query("mangaId");
    if (raw == null) return [];
    const n = Number(raw);
    if (!Number.isFinite(n)) return [];
    return [{ path: "mangaId", value: Math.trunc(n) }];
}

function parseSort(c: { req: { query: (k: string) => string | undefined } }, defaultDir: "ASC" | "DESC" = "ASC"): { field: string; dir: "ASC" | "DESC" } | null {
    const field = c.req.query("sort");
    if (!field) return null;
    const dir = c.req.query("dir") === "desc" ? "DESC" : defaultDir === "DESC" ? "DESC" : "ASC";
    return { field, dir: dir as "ASC" | "DESC" };
}

function badRequest(message = "Username or password is invalid!"): Response {
    return plainText(message, 400);
}

function unauthorized(message = "Unauthorized"): Response {
    return plainText(message, 401);
}

const DEFAULT_BODY_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB — Free plan safe

function resolveBodyLimit(env: Env): number {
    const raw = env.MAX_REQUEST_BODY_BYTES;
    if (raw) {
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return DEFAULT_BODY_LIMIT_BYTES;
}

async function rejectIfTooLarge(c: { env: Env; req: { raw: Request; header: (name: string) => string | undefined } }): Promise<Response | null> {
    const limit = resolveBodyLimit(c.env);
    const contentLength = c.req.header("content-length");
    if (contentLength) {
        const bytes = Number.parseInt(contentLength, 10);
        if (Number.isFinite(bytes) && bytes > limit) {
            return plainText(`Request body too large (${bytes} bytes, max ${limit})`, 413);
        }
    }
    return null;
}

async function requireUserId(c: { env: Env; req: { raw: Request } }): Promise<string | null> {
    const cookieName = c.env.AUTH_COOKIE_NAME?.trim() || "id";
    const token = getTokenFromRequest(c.req.raw, cookieName);
    if (!token) {
        return null;
    }
    const payload = await verifyJwt(c.env.JWT_SECRET, token);
    return payload?.sub ?? null;
}

function readString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

async function readJsonBody<T>(c: { req: { json: () => Promise<unknown>; raw: Request; header: (name: string) => string | undefined } }): Promise<T | null> {
    const contentType = (c.req.header("content-type") || "").toLowerCase();
    if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = (await c.req.raw.formData()) as unknown as { keys(): IterableIterator<string>; get(k: string): unknown };
        const out: Record<string, string> = {};
        for (const k of form.keys()) {
            const v = form.get(k);
            out[k] = typeof v === "string" ? v : "";
        }
        return out as unknown as T;
    }
    try {
        return (await c.req.json()) as T;
    } catch {
        return null;
    }
}

function renderDashboard(c: Context, initialPage: PageId): Response {
    return c.html(renderDashboardHtml(c.env.APP_NAME ?? "Mangayomi Sync", initialPage, dashboardStyles));
}

function resolvePageIdFromPath(path: string): PageId {
    const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!normalized) {
        return "home";
    }
    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    if (segments[0] !== "web") {
        return "home";
    }
    const candidate = segments[1] ?? "home";
    return isPageId(candidate) ? candidate : "home";
}

// ---------------------------------------------------------------------------
// Health / introspection
// ---------------------------------------------------------------------------

app.get("/health", (c) =>
    c.json({ ok: true, service: c.env.APP_NAME ?? "Mangayomi Sync", timestamp: Date.now() }),
);

app.get("/me", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }
    const user = await getUserById(c.env.DB, userId);
    if (!user) {
        return unauthorized();
    }
    return c.json({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    });
});

app.get("/stats", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }
    return c.json(await getSyncStats(c.env.DB, userId));
});

// ---------------------------------------------------------------------------
// Read-only sync browser endpoints (UI only; the Flutter client still uses
// the POST /sync/* endpoints defined further down).
// ---------------------------------------------------------------------------

for (const table of READ_ONLY_GET_ENTITIES) {
    app.get(`/sync/${table}`, async (c) => {
        const userId = await requireUserId(c);
        if (!userId) {
            return unauthorized();
        }
        const limit = clampPageLimit(c.req.query("limit"));
        const after = parseAfterCursor(c.req.query("after"));

        // Per-table URL params. Unknown values are dropped by the allowlists
        // in listEntitiesPaged; this just translates the public URL surface
        // into a uniform `filters` / `sort` shape.
        let filters: Array<{ path: string; value: string | number | boolean }> = [];
        let sort: { field: string; dir: "ASC" | "DESC" } | null = null;
        let chapterMangaId: number | null = null;
        switch (table) {
            case "chapters": {
                const p = parseChapterFilters(c);
                filters = p.filters;
                sort = p.sort;
                chapterMangaId = p.mangaId;
                break;
            }
            case "tracks":
            case "histories":
            case "updates":
                filters = parseMangaIdFilter(c);
                sort = parseSort(c, "DESC");
                break;
            case "manga":
                sort = parseSort(c);
                break;
            case "categories":
                sort = parseSort(c);
                break;
            default:
                break;
        }

        const paged =
            (await listEntitiesPagedBrowse(c.env.DB, table, userId, {
                limit,
                after,
                filters: filters.length > 0 ? filters : undefined,
                sort,
            })) ??
            (await listEntitiesPaged(c.env.DB, table, userId, {
                limit,
                after,
                filters: filters.length > 0 ? filters : undefined,
                sort,
            }));
        const enriched = await enrichForBrowser(c.env.DB, table, userId, paged.items, { chapterMangaId });
        return c.json({
            [table]: enriched,
            items: enriched,
            nextCursor: paged.nextCursor,
            total: paged.total,
            hasMore: paged.nextCursor !== null,
            limit,
            after: after ?? 0,
            filters: filters.length > 0 ? filters : undefined,
            sort: sort ?? undefined,
            resetAll: false,
        });
    });
}

app.get("/sync/settings", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }
    const settings = (await getSettings(c.env.DB, userId)) ?? (await ensureDefaultSettings(c.env.DB, userId));
    return c.json({ settings });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post("/register", async (c) => {
    const body = await readJsonBody<CredentialsBody>(c);
    const email = normalizeEmail(readString(body?.email));
    const password = readString(body?.password);

    if (!isValidEmail(email) || !isValidPassword(password)) {
        return badRequest();
    }

    const existing = await getUserByEmail(c.env.DB, email);
    if (existing) {
        return plainText(`Account already exists ${email}!`, 409);
    }

    const now = Date.now();
    const userId = buildDefaultUserId();
    await createUser(c.env.DB, {
        id: userId,
        email,
        passwordHash: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
    });
    await ensureDefaultSettings(c.env.DB, userId);

    const auth = await issueAuthHeaders(c.env, userId, isSecureRequest(c.req.raw));
    return plainText("Account registered!", 200, auth.headers);
});

app.post("/login", async (c) => {
    const body = await readJsonBody<CredentialsBody>(c);
    const email = normalizeEmail(readString(body?.email));
    const password = readString(body?.password);

    if (!isValidEmail(email) || !isValidPassword(password)) {
        return badRequest();
    }

    const account = await getUserByEmail(c.env.DB, email);
    if (!account) {
        return plainText(`Account not found ${email}!`, 401);
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
        return plainText(`Account not found ${email}!`, 401);
    }

    // Transparent migration from Argon2id (legacy Rust server) to PBKDF2.
    if (isLegacyHash(account.password_hash)) {
        try {
            const newHash = await hashPassword(password);
            await updateUserPassword(c.env.DB, account.id, newHash, Date.now());
        } catch {
            // Best-effort rehash; do not block login.
        }
    }

    await ensureDefaultSettings(c.env.DB, account.id);
    const auth = await issueAuthHeaders(c.env, account.id, isSecureRequest(c.req.raw));
    return plainText(`Welcome ${account.email}!`, 200, auth.headers);
});

app.get("/logout", (c) =>
    plainText("Logged out!", 200, clearAuthHeaders(c.env, isSecureRequest(c.req.raw))),
);

app.post("/profile", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }

    const body = await readJsonBody<UpdateProfileBody>(c);
    const email = normalizeEmail(readString(body?.email));
    const password = readString(body?.password);
    const passwordOld = readString(body?.passwordOld);

    if (!isValidEmail(email) || !isValidPassword(password) || !isValidPassword(passwordOld)) {
        return plainText("", 400);
    }

    const user = await getUserById(c.env.DB, userId);
    if (!user) {
        return plainText("", 400);
    }

    const oldValid = await verifyPassword(passwordOld, user.password_hash);
    if (!oldValid) {
        return plainText("", 400);
    }

    if (email.toLowerCase() !== user.email.toLowerCase()) {
        const duplicate = await getUserByEmail(c.env.DB, email);
        if (duplicate && duplicate.id !== userId) {
            return plainText("", 400);
        }
    }

    const updated = await updateUser(c.env.DB, userId, {
        email,
        passwordHash: await hashPassword(password),
        updatedAt: Date.now(),
    });

    if (!updated) {
        return plainText("", 400);
    }

    const auth = await issueAuthHeaders(c.env, userId, isSecureRequest(c.req.raw));
    return plainText("Account updated!", 200, auth.headers);
});

app.delete("/delete", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }

    const user = await getUserById(c.env.DB, userId);
    if (!user) {
        return plainText("", 400);
    }

    await deleteUserCascade(c.env.DB, userId);
    return plainText(
        "Account successfully deleted!",
        200,
        clearAuthHeaders(c.env, isSecureRequest(c.req.raw)),
    );
});

// ---------------------------------------------------------------------------
// Sync (write paths; used by the Flutter client)
// ---------------------------------------------------------------------------

app.post("/sync/manga", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }

    const tooLarge = await rejectIfTooLarge(c);
    if (tooLarge) return tooLarge;

    const body = await readJsonBody<MangaSyncBody>(c);
    if (!body) {
        return plainText("Invalid JSON", 400);
    }

    const resetAll = body.resetAll === true;

    const parseAfter = (raw: unknown): number | null => {
        if (raw == null) return null;
        const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.trunc(n);
    };

    try {
        const [categories, manga, chapters, tracks] = await Promise.all([
            syncEntityListPaged(c.env.DB, "categories", userId, body.categories, body.deleted_categories, resetAll, parseAfter(body.after_categories), MAX_RESPONSE_ROWS),
            syncEntityListPaged(c.env.DB, "manga", userId, body.manga, body.deleted_manga, resetAll, parseAfter(body.after_manga), MAX_RESPONSE_ROWS),
            syncEntityListPaged(c.env.DB, "chapters", userId, body.chapters, body.deleted_chapters, resetAll, parseAfter(body.after_chapters), MAX_RESPONSE_ROWS),
            syncEntityListPaged(c.env.DB, "tracks", userId, body.tracks, body.deleted_tracks, resetAll, parseAfter(body.after_tracks), MAX_RESPONSE_ROWS),
        ]);

        return c.json({
            categories: categories.items,
            manga: manga.items,
            chapters: chapters.items,
            tracks: tracks.items,
            deleted_categories: [],
            deleted_manga: [],
            deleted_chapters: [],
            deleted_tracks: [],
            resetAll: body.resetAll ?? false,
            nextCursor: {
                categories: categories.nextCursor,
                manga: manga.nextCursor,
                chapters: chapters.nextCursor,
                tracks: tracks.nextCursor,
            },
            total: {
                categories: categories.total,
                manga: manga.total,
                chapters: chapters.total,
                tracks: tracks.total,
            },
        });
    } catch (err) {
        console.error("sync/manga failed", err);
        return plainText("Invalid sync payload", 400);
    }
});

app.post("/sync/histories", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }

    const tooLarge = await rejectIfTooLarge(c);
    if (tooLarge) return tooLarge;

    const body = await readJsonBody<HistorySyncBody>(c);
    if (!body) {
        return plainText("Invalid JSON", 400);
    }

    const parseAfter = (raw: unknown): number | null => {
        if (raw == null) return null;
        const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.trunc(n);
    };

    try {
        const histories = await syncEntityListPaged(
            c.env.DB,
            "histories",
            userId,
            body.histories,
            body.deleted_histories,
            body.resetAll === true,
            parseAfter(body.after_histories),
            MAX_RESPONSE_ROWS,
        );
        return c.json({
            histories: histories.items,
            deleted_histories: [],
            resetAll: body.resetAll ?? false,
            nextCursor: {
                histories: histories.nextCursor,
            },
            total: {
                histories: histories.total,
            },
        });
    } catch (err) {
        console.error("sync/histories failed", err);
        return plainText("Invalid sync payload", 400);
    }
});

app.post("/sync/updates", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }

    const tooLarge = await rejectIfTooLarge(c);
    if (tooLarge) return tooLarge;

    const body = await readJsonBody<UpdateSyncBody>(c);
    if (!body) {
        return plainText("Invalid JSON", 400);
    }

    const parseAfter = (raw: unknown): number | null => {
        if (raw == null) return null;
        const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.trunc(n);
    };

    try {
        const updates = await syncEntityListPaged(
            c.env.DB,
            "updates",
            userId,
            body.updates,
            body.deleted_updates,
            body.resetAll === true,
            parseAfter(body.after_updates),
            MAX_RESPONSE_ROWS,
        );
        return c.json({
            updates: updates.items,
            deleted_updates: [],
            resetAll: body.resetAll ?? false,
            nextCursor: {
                updates: updates.nextCursor,
            },
            total: {
                updates: updates.total,
            },
        });
    } catch (err) {
        console.error("sync/updates failed", err);
        return plainText("Invalid sync payload", 400);
    }
});

app.post("/sync/settings", async (c) => {
    const userId = await requireUserId(c);
    if (!userId) {
        return unauthorized();
    }

    const body = await readJsonBody<SettingsWrapper>(c);
    if (!body) {
        return plainText("Invalid JSON", 400);
    }

    try {
        const settings = await syncSettings(c.env.DB, userId, body.settings);
        return c.json({ settings });
    } catch (err) {
        console.error("sync/settings failed", err);
        return plainText("Invalid sync payload", 400);
    }
});

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

app.get("/", (c) => renderDashboard(c, "home"));
app.get("/web", (c) => renderDashboard(c, "home"));
app.get("/web/:page", (c) => renderDashboard(c, resolvePageIdFromPath(c.req.path)));
app.get("/web/*", (c) => renderDashboard(c, "home"));

app.onError((error, c) => {
    console.error(error);
    return c.text("Internal Server Error", 500);
});

export default app;
