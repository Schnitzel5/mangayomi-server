export type JsonObject = Record<string, unknown>;
export type JsonValue = JsonObject | JsonValue[] | string | number | boolean | null;

export interface UserRow {
    id: string;
    email: string;
    password_hash: string;
    created_at: number;
    updated_at: number;
}

export interface UserCreateInput {
    id: string;
    email: string;
    passwordHash: string;
    createdAt: number;
    updatedAt: number;
}

export interface UserUpdateInput {
    email: string;
    passwordHash?: string;
    updatedAt: number;
}

export interface SyncStats {
    categories: number;
    manga: number;
    chapters: number;
    tracks: number;
    histories: number;
    updates: number;
    settings: number;
}

const ENTITY_TABLES = {
    categories: "sync_categories",
    manga: "sync_manga",
    chapters: "sync_chapters",
    tracks: "sync_tracks",
    histories: "sync_histories",
    updates: "sync_updates",
    settings: "sync_settings",
} as const;

export type EntityTable = keyof typeof ENTITY_TABLES;

const SYNC_TABLES: readonly EntityTable[] = [
    "categories",
    "manga",
    "chapters",
    "tracks",
    "histories",
    "updates",
    "settings",
];

// 100 bound parameters per D1 statement (4 columns per row -> 25 rows).
const UPSERT_ROWS_PER_STATEMENT = 20;
// 1000 statements per D1 batch().
const STATEMENTS_PER_BATCH = 50;
const UPSERT_ROWS_PER_BATCH = UPSERT_ROWS_PER_STATEMENT * STATEMENTS_PER_BATCH;

// 2 columns per row in a delete -> 50 ids per statement.
const DELETE_IDS_PER_STATEMENT = 50;
const DELETE_STATEMENTS_PER_BATCH = 20;
const DELETE_IDS_PER_BATCH = DELETE_IDS_PER_STATEMENT * DELETE_STATEMENTS_PER_BATCH;

const DEFAULT_SETTINGS_ID = 227;
const MAX_PAYLOAD_BYTES = 1_000_000;
export const MAX_RESPONSE_ROWS = 50_000;

export function tableName(table: EntityTable): string {
    return ENTITY_TABLES[table];
}

export function buildDefaultUserId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function toJsonObject(value: unknown, label = "payload"): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value as JsonObject;
}

export function toJsonArray(value: unknown, label = "items"): JsonObject[] {
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array`);
    }
    return value.map((entry, index) => toJsonObject(entry, `${label}[${index}]`));
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function normalizeEntityId(entity: JsonObject, label: string): number {
    const id = toFiniteNumber(entity.id);
    if (id === null) {
        throw new Error(`${label} is missing a numeric id`);
    }
    return id;
}

function normalizeUpdatedAt(entity: JsonObject): number {
    const updatedAt = toFiniteNumber(entity.updatedAt);
    return updatedAt ?? Date.now();
}

function nowMs(): number {
    return Date.now();
}

function chunk<T>(items: readonly T[], size: number): T[][] {
    if (size <= 0) {
        throw new Error("chunk size must be positive");
    }
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

function placeholders(count: number): string {
    return `(${Array.from({ length: count }, () => "?").join(",")})`;
}

// Flutter client tracker `syncId` constants (see kodjodevf/mangayomi Tracker).
// Used by the dashboard to label tracking rows; unknown ids fall back to
// "Tracker <id>" so the column is never blank.
export const TRACKER_NAMES: Record<number, string> = {
    1: "AniList",
    2: "MyAnimeList",
    3: "Kitsu",
    4: "Shikimori",
    5: "Bangumi",
    6: "Simkl",
    7: "MangaUpdates",
    8: "YuSeries",
};

export function trackerName(syncId: unknown): string {
    const id = toFiniteNumber(syncId);
    if (id === null) {
        return "—";
    }
    return TRACKER_NAMES[id] ?? `Tracker ${id}`;
}

export function itemTypeName(value: unknown): string {
    const n = toFiniteNumber(value);
    switch (n) {
        case 0:
            return "Manga";
        case 1:
            return "Anime";
        case 2:
            return "Novel";
        default:
            return n === null ? "—" : `Type ${n}`;
    }
}

export function mangaStatusName(value: unknown): string {
    const n = toFiniteNumber(value);
    switch (n) {
        case 0:
            return "Ongoing";
        case 1:
            return "Completed";
        case 2:
            return "Licensed";
        case 3:
            return "Publishing finished";
        case 4:
            return "Cancelled";
        case 5:
            return "On hiatus";
        default:
            return n === null ? "—" : `Status ${n}`;
    }
}

export interface MangaLookupRow {
    name: string;
    source: string;
    itemType: number;
    favorite: boolean;
    status: number;
    lang: string;
    lastUpdate: number;
    dateAdded: number;
}

export interface ChapterLookupRow {
    name: string;
    mangaId: number;
    dateUpload: string;
    isRead: boolean;
    isBookmarked: boolean;
    scanlator: string;
    lastPageRead: string;
}

export interface SyncLookups {
    manga: Map<number, MangaLookupRow>;
    chapters: Map<number, ChapterLookupRow>;
}

function toBool(value: unknown): boolean {
    return value === true || value === "true" || value === 1 || value === "1";
}

function toStr(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

export interface BuildLookupsOptions {
    // When set, only chapters for the given manga are loaded into the
    // chapter lookup map. This is the big win on the Chapters page: at
    // 1.5M chapters the full lookup would otherwise re-deserialise every
    // payload on every request.
    chapterMangaId?: number | null | undefined;
}

export async function buildLookups(
    db: D1Database,
    userId: string,
    options: BuildLookupsOptions = {},
): Promise<SyncLookups> {
    const chapterMangaId = options.chapterMangaId;
    const chapterSql =
        chapterMangaId == null
            ? `SELECT payload_json FROM ${tableName("chapters")} WHERE user_id = ?1`
            : `SELECT payload_json FROM ${tableName("chapters")} ` +
              `WHERE user_id = ?1 AND json_extract(payload_json, '$.mangaId') = ?2`;
    const chapterBinds: Array<string | number> =
        chapterMangaId == null ? [userId] : [userId, chapterMangaId];

    const [mangaRows, chapterRows] = await Promise.all([
        db
            .prepare(`SELECT payload_json FROM ${tableName("manga")} WHERE user_id = ?1`)
            .bind(userId)
            .all<{ payload_json: string }>(),
        db.prepare(chapterSql).bind(...chapterBinds).all<{ payload_json: string }>(),
    ]);

    const manga = new Map<number, MangaLookupRow>();
    for (const row of mangaRows.results ?? []) {
        try {
            const obj = toJsonObject(JSON.parse(row.payload_json), "manga");
            const id = toFiniteNumber(obj.id);
            if (id === null) {
                continue;
            }
            manga.set(id, {
                name: toStr(obj.name),
                source: toStr(obj.source),
                itemType: toFiniteNumber(obj.itemType) ?? 0,
                favorite: toBool(obj.favorite),
                status: toFiniteNumber(obj.status) ?? 0,
                lang: toStr(obj.lang),
                lastUpdate: toFiniteNumber(obj.lastUpdate) ?? 0,
                dateAdded: toFiniteNumber(obj.dateAdded) ?? 0,
            });
        } catch {
            // skip malformed
        }
    }

    const chapters = new Map<number, ChapterLookupRow>();
    for (const row of chapterRows.results ?? []) {
        try {
            const obj = toJsonObject(JSON.parse(row.payload_json), "chapter");
            const id = toFiniteNumber(obj.id);
            if (id === null) {
                continue;
            }
            chapters.set(id, {
                name: toStr(obj.name),
                mangaId: toFiniteNumber(obj.mangaId) ?? 0,
                dateUpload: toStr(obj.dateUpload),
                isRead: toBool(obj.isRead),
                isBookmarked: toBool(obj.isBookmarked),
                scanlator: toStr(obj.scanlator),
                lastPageRead: toStr(obj.lastPageRead),
            });
        } catch {
            // skip malformed
        }
    }

    return { manga, chapters };
}

// Enrich a chapter row with the joined manga display name.
export function enrichChapter(
    row: JsonObject,
    lookups: SyncLookups,
    ownRow: ChapterLookupRow | undefined,
): JsonObject {
    const mangaId = toFiniteNumber(row.mangaId) ?? ownRow?.mangaId ?? 0;
    const mangaName = lookups.manga.get(mangaId)?.name ?? "";
    return { ...row, mangaName };
}

// Enrich a history row with manga name and chapter name.
export function enrichHistory(row: JsonObject, lookups: SyncLookups): JsonObject {
    const mangaId = toFiniteNumber(row.mangaId) ?? 0;
    const chapterId = toFiniteNumber(row.chapterId) ?? 0;
    const mangaName = lookups.manga.get(mangaId)?.name ?? "";
    const chapterName = lookups.chapters.get(chapterId)?.name ?? "";
    return { ...row, mangaName, chapterName };
}

// Enrich an update row with manga name (chapterName is already on the payload).
export function enrichUpdate(row: JsonObject, lookups: SyncLookups): JsonObject {
    const mangaId = toFiniteNumber(row.mangaId) ?? 0;
    const mangaName = lookups.manga.get(mangaId)?.name ?? "";
    return { ...row, mangaName };
}

// Enrich a track row with manga name and synthetic tracker name.
export function enrichTrack(row: JsonObject, lookups: SyncLookups): JsonObject {
    const mangaId = toFiniteNumber(row.mangaId) ?? 0;
    const mangaName = lookups.manga.get(mangaId)?.name ?? "";
    const tracker = trackerName(row.syncId);
    return { ...row, mangaName, tracker };
}

export function defaultSettingsPayload(now: number = nowMs()): JsonObject {
    return {
        id: DEFAULT_SETTINGS_ID,
        updatedAt: now,
        displayType: 0,
        scaleType: 0,
        backgroundColor: 0,
        defaultReaderMode: 0,
        disableSectionType: 0,
        libraryShowCategoryTabs: false,
        animeLibraryShowCategoryTabs: false,
        novelLibraryShowCategoryTabs: false,
        libraryDownloadedChapters: false,
        animeLibraryDownloadedChapters: false,
        novelLibraryDownloadedChapters: false,
        libraryShowLanguage: false,
        animeLibraryShowLanguage: false,
        novelLibraryShowLanguage: false,
        libraryShowNumbersOfItems: false,
        animeLibraryShowNumbersOfItems: false,
        novelLibraryShowNumbersOfItems: false,
        libraryShowContinueReadingButton: false,
        animeLibraryShowContinueReadingButton: false,
        novelLibraryShowContinueReadingButton: false,
        pagePreloadAmount: 1,
        checkForAppUpdates: false,
        checkForExtensionUpdates: false,
    };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
    return db
        .prepare("SELECT id, email, password_hash, created_at, updated_at FROM users WHERE id = ?1 LIMIT 1")
        .bind(id)
        .first<UserRow>();
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
    return db
        .prepare("SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = ?1 LIMIT 1")
        .bind(email)
        .first<UserRow>();
}

export async function createUser(db: D1Database, input: UserCreateInput): Promise<UserRow> {
    await db
        .prepare(
            "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(input.id, input.email, input.passwordHash, input.createdAt, input.updatedAt)
        .run();

    const row = await getUserById(db, input.id);
    if (!row) {
        throw new Error("Failed to create user");
    }
    return row;
}

export async function updateUser(db: D1Database, id: string, input: UserUpdateInput): Promise<UserRow | null> {
    const current = await getUserById(db, id);
    if (!current) {
        return null;
    }
    await db
        .prepare(
            "UPDATE users SET email = ?1, password_hash = COALESCE(?2, password_hash), updated_at = ?3 WHERE id = ?4",
        )
        .bind(input.email, input.passwordHash ?? null, input.updatedAt, id)
        .run();
    return getUserById(db, id);
}

export async function updateUserPassword(db: D1Database, id: string, passwordHash: string, updatedAt: number): Promise<void> {
    await db
        .prepare("UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(passwordHash, updatedAt, id)
        .run();
}

export async function deleteUserCascade(db: D1Database, userId: string): Promise<void> {
    const statements: D1PreparedStatement[] = [];
    for (const table of SYNC_TABLES) {
        statements.push(db.prepare(`DELETE FROM ${tableName(table)} WHERE user_id = ?1`).bind(userId));
    }
    statements.push(db.prepare("DELETE FROM users WHERE id = ?1").bind(userId));
    await runBatched(db, statements);
}

export async function ensureDefaultSettings(db: D1Database, userId: string): Promise<JsonObject> {
    const existing = await getSettings(db, userId);
    if (existing) {
        return existing;
    }
    const payload = defaultSettingsPayload();
    await upsertEntity(db, "settings", userId, payload);
    return payload;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(db: D1Database, userId: string): Promise<JsonObject | null> {
    const row = await db
        .prepare("SELECT payload_json FROM sync_settings WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1")
        .bind(userId)
        .first<{ payload_json: string }>();
    if (!row) {
        return null;
    }
    try {
        return toJsonObject(JSON.parse(row.payload_json), "settings");
    } catch {
        return null;
    }
}

export async function syncSettings(db: D1Database, userId: string, incoming: unknown): Promise<JsonObject> {
    if (incoming != null) {
        const payload = toJsonObject(incoming, "settings");
        if (payload.id == null) {
            payload.id = DEFAULT_SETTINGS_ID;
        }
        if (payload.updatedAt == null) {
            payload.updatedAt = nowMs();
        }
        await upsertEntity(db, "settings", userId, payload);
    }

    const settings = await getSettings(db, userId);
    if (settings) {
        return settings;
    }
    return ensureDefaultSettings(db, userId);
}

// ---------------------------------------------------------------------------
// Generic entity table helpers
// ---------------------------------------------------------------------------

export async function listEntities(db: D1Database, table: EntityTable, userId: string): Promise<JsonObject[]> {
    const rowset = await db
        .prepare(`SELECT payload_json FROM ${tableName(table)} WHERE user_id = ?1 ORDER BY entity_id ASC`)
        .bind(userId)
        .all<{ payload_json: string }>();
    const rows = rowset.results ?? [];
    const out: JsonObject[] = [];
    for (const row of rows) {
        try {
            out.push(toJsonObject(JSON.parse(row.payload_json), table));
        } catch {
            // skip malformed rows
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Keyset pagination (Phase 1). Same JSON shape per page, plus a `nextCursor`
// that points at the last row's `entity_id` so the caller can keep paging.
// Used by the read-only GET /sync/* browsers; the write path's POST /sync/*
// still calls `listEntities` and is updated in Phase 5.
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_LIMIT = 500;
const MAX_PAGE_LIMIT = 5_000;

// Whitelist of JSON paths that the GET /sync/* endpoints will accept as
// filter predicates. The dashboard sends them as ?mangaId, ?read, etc. and
// they map to a single json_extract() clause. Anything not in the list is
// silently dropped so unknown query params cannot touch the SQL.
const ALLOWED_FILTER_PATHS: Record<EntityTable, ReadonlySet<string>> = {
    categories: new Set(["forItemType", "hide", "shouldUpdate"]),
    manga: new Set(["itemType", "favorite", "status", "lang"]),
    chapters: new Set(["mangaId", "isRead", "isBookmarked", "scanlator"]),
    tracks: new Set(["mangaId", "syncId"]),
    histories: new Set(["mangaId", "chapterId"]),
    updates: new Set(["mangaId"]),
    settings: new Set(),
};

// Whitelist of JSON paths usable as ORDER BY columns. `entity_id` is always
// allowed and is the default. Anything else is validated against the set
// for the table; unknown values fall back to `entity_id`.
const ALLOWED_SORT_FIELDS: Record<EntityTable, ReadonlySet<string>> = {
    categories: new Set(["entity_id", "name", "pos", "forItemType", "updatedAt"]),
    manga: new Set(["entity_id", "name", "lastUpdate", "dateAdded", "updatedAt"]),
    chapters: new Set([
        "entity_id",
        "name",
        "mangaId",
        "isRead",
        "isBookmarked",
        "dateUpload",
        "lastPageRead",
        "updatedAt",
    ]),
    tracks: new Set(["entity_id", "mangaId", "syncId", "lastChapterRead", "updatedAt"]),
    histories: new Set(["entity_id", "mangaId", "chapterId", "date", "readingTimeSeconds", "updatedAt"]),
    updates: new Set(["entity_id", "mangaId", "date", "updatedAt"]),
    settings: new Set(["entity_id", "updatedAt"]),
};

export function clampPageLimit(value: unknown, fallback = DEFAULT_PAGE_LIMIT): number {
    const n = toFiniteNumber(value);
    if (n === null) {
        return fallback;
    }
    if (n <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(n), MAX_PAGE_LIMIT);
}

export function parseAfterCursor(value: unknown): number | null {
    const n = toFiniteNumber(value);
    if (n === null) {
        return null;
    }
    return Math.floor(n);
}

export interface EntityFilter {
    path: string;
    value: string | number | boolean;
}

export interface EntitySort {
    field: string;
    dir: "ASC" | "DESC";
}

export interface ListEntitiesPagedOptions {
    limit: number;
    after?: number | null | undefined;
    filters?: EntityFilter[] | undefined;
    sort?: EntitySort | null | undefined;
}

export interface PagedResult {
    items: JsonObject[];
    nextCursor: number | null;
    total: number;
}

function sortColumnExpression(table: EntityTable, field: string): string {
    if (field === "entity_id") {
        return "entity_id";
    }
    if (!ALLOWED_SORT_FIELDS[table].has(field)) {
        return "entity_id";
    }
    return `json_extract(payload_json, '$.${field}')`;
}

function buildWhereClause(
    table: EntityTable,
    filters: EntityFilter[] | undefined,
    userId: string,
    after: number | null,
    includeAfter: boolean,
): { sql: string; binds: Array<string | number | boolean> } {
    const clauses: string[] = ["user_id = ?1"];
    const binds: Array<string | number | boolean> = [userId];
    if (includeAfter && after !== null) {
        binds.push(after);
        clauses.push(`entity_id > ?${binds.length}`);
    }
    if (filters) {
        for (const f of filters) {
            if (!ALLOWED_FILTER_PATHS[table].has(f.path)) {
                continue;
            }
            binds.push(f.value);
            clauses.push(`json_extract(payload_json, '$.${f.path}') = ?${binds.length}`);
        }
    }
    return { sql: clauses.join(" AND "), binds };
}

export async function listEntitiesPaged(
    db: D1Database,
    table: EntityTable,
    userId: string,
    opts: ListEntitiesPagedOptions,
): Promise<PagedResult> {
    const sqlTable = tableName(table);
    const limit = Math.max(1, Math.min(opts.limit, MAX_PAGE_LIMIT));
    const after = opts.after ?? 0;

    const pagedWhere = buildWhereClause(table, opts.filters, userId, after, true);
    const countWhere = buildWhereClause(table, opts.filters, userId, null, false);
    const orderExpr = sortColumnExpression(table, opts.sort?.field ?? "entity_id");
    const orderDir = opts.sort?.dir === "DESC" ? "DESC" : "ASC";
    const limitBindIdx = pagedWhere.binds.length + 1;

    const pagedSql =
        `SELECT entity_id, payload_json FROM ${sqlTable} ` +
        `WHERE ${pagedWhere.sql} ` +
        `ORDER BY ${orderExpr} ${orderDir} ` +
        `LIMIT ?${limitBindIdx}`;
    const countSql = `SELECT COUNT(*) AS count FROM ${sqlTable} WHERE ${countWhere.sql}`;

    const [rowsResult, countResult] = await Promise.all([
        db
            .prepare(pagedSql)
            .bind(...pagedWhere.binds, limit)
            .all<{ entity_id: number; payload_json: string }>(),
        db
            .prepare(countSql)
            .bind(...countWhere.binds)
            .first<{ count: number }>(),
    ]);

    const items: JsonObject[] = [];
    let lastEntityId = after;
    for (const row of rowsResult.results ?? []) {
        try {
            items.push(toJsonObject(JSON.parse(row.payload_json), table));
        } catch {
            // skip malformed rows
        }
        lastEntityId = row.entity_id;
    }

    const total = Number(countResult?.count ?? 0);
    const nextCursor = items.length === limit && lastEntityId > after ? lastEntityId : null;

    return { items, nextCursor, total };
}

// ---------------------------------------------------------------------------
// Browse-table read path. Sibling of listEntitiesPaged; reads from the slim
// projection table so filters / sorts hit real indexed columns instead of
// `json_extract(payload_json, '$.…')` on the source row. Falls back to
// returning `null` if the table has no projection or the request uses a
// filter / sort field we don't track, so the caller can use the legacy path.
// ---------------------------------------------------------------------------

const BROWSE_PATH_COLUMN: Partial<Record<EntityTable, Record<string, string>>> = {
    chapters: {
        name: "name",
        mangaId: "manga_id",
        isRead: "is_read",
        isBookmarked: "is_bookmarked",
        dateUpload: "date_upload",
        lastPageRead: "last_page_read",
    },
    manga: {
        name: "name",
        source: "source",
        itemType: "item_type",
        favorite: "favorite",
        status: "status",
        lang: "lang",
        lastUpdate: "last_update",
        dateAdded: "date_added",
    },
    tracks: {
        title: "title",
        mangaId: "manga_id",
        syncId: "sync_id",
    },
    histories: {
        date: "date",
        mangaId: "manga_id",
        chapterId: "chapter_id",
        readingTimeSeconds: "reading_time_seconds",
    },
    updates: {
        date: "date",
        mangaId: "manga_id",
    },
    categories: {
        name: "name",
        pos: "pos",
        forItemType: "for_item_type",
        hide: "hide",
        shouldUpdate: "should_update",
    },
};

function browseSortColumn(table: EntityTable, field: string): { column: string; isBoolean: boolean } | null {
    if (field === "entity_id") {
        return { column: "entity_id", isBoolean: false };
    }
    const cols = BROWSE_PATH_COLUMN[table];
    if (!cols) return null;
    const col = cols[field];
    if (!col) return null;
    const isBoolean = col === "is_read" || col === "is_bookmarked" || col === "favorite" || col === "hide" || col === "should_update";
    return { column: col, isBoolean };
}

export async function listEntitiesPagedBrowse(
    db: D1Database,
    table: EntityTable,
    userId: string,
    opts: ListEntitiesPagedOptions,
): Promise<PagedResult | null> {
    const browseTable = BROWSE_TABLE_NAME[table];
    const browsePk = BROWSE_PK_COLUMN[table];
    if (!browseTable || !browsePk) return null;

    const limit = Math.max(1, Math.min(opts.limit, MAX_PAGE_LIMIT));
    const after = opts.after ?? 0;

    const sortField = opts.sort?.field ?? "entity_id";
    const sortInfo = browseSortColumn(table, sortField);
    if (!sortInfo) return null;
    const orderDir = opts.sort?.dir === "DESC" ? "DESC" : "ASC";

    const cols = BROWSE_PATH_COLUMN[table]!;
    const clauses: string[] = ["user_id = ?1"];
    const binds: Array<string | number | boolean> = [userId];
    if (after > 0) {
        binds.push(after);
        clauses.push(`${browsePk} > ?${binds.length}`);
    }
    if (opts.filters) {
        for (const f of opts.filters) {
            const col = cols[f.path];
            if (!col) return null;
            binds.push(typeof f.value === "boolean" ? (f.value ? 1 : 0) : f.value);
            clauses.push(`${col} = ?${binds.length}`);
        }
    }
    const whereSql = clauses.join(" AND ");
    const limitBindIdx = binds.length + 1;

    const pagedSql =
        `SELECT ${browsePk} AS entity_id, payload_json FROM ${browseTable} ` +
        `WHERE ${whereSql} ` +
        `ORDER BY ${sortInfo.column} ${orderDir}, ${browsePk} ${orderDir} ` +
        `LIMIT ?${limitBindIdx}`;
    const countSql = `SELECT COUNT(*) AS count FROM ${browseTable} WHERE ${whereSql}`;

    const [rowsResult, countResult] = await Promise.all([
        db
            .prepare(pagedSql)
            .bind(...binds, limit)
            .all<{ entity_id: number; payload_json: string }>(),
        db
            .prepare(countSql)
            .bind(...binds)
            .first<{ count: number }>(),
    ]);

    const items: JsonObject[] = [];
    let lastEntityId = after;
    for (const row of rowsResult.results ?? []) {
        try {
            items.push(toJsonObject(JSON.parse(row.payload_json), table));
        } catch {
            // skip malformed rows
        }
        lastEntityId = row.entity_id;
    }

    const total = Number(countResult?.count ?? 0);
    const nextCursor = items.length === limit && lastEntityId > after ? lastEntityId : null;
    return { items, nextCursor, total };
}

export async function countEntities(
    db: D1Database,
    table: EntityTable,
    userId: string,
): Promise<number> {
    const row = await db
        .prepare(`SELECT COUNT(*) AS count FROM ${tableName(table)} WHERE user_id = ?1`)
        .bind(userId)
        .first<{ count: number }>();
    return Number(row?.count ?? 0);
}

export interface UpsertEntityResult {
    accepted: number;
    rejected: number;
    invalid: number;
}

interface NormalizedEntity {
    id: number;
    updatedAt: number;
    payload: string;
    size: number;
}

function serializeEntity(table: EntityTable, entity: JsonObject, label: string): NormalizedEntity | { error: string } {
    try {
        const id = normalizeEntityId(entity, label);
        const updatedAt = normalizeUpdatedAt(entity);
        const payload = JSON.stringify(entity);
        const size = payload.length;
        if (size > MAX_PAYLOAD_BYTES) {
            return { error: `${label} payload exceeds 1MB (got ${size} bytes)` };
        }
        return { id, updatedAt, payload, size };
    } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
    }
}

// ---------------------------------------------------------------------------
// Browse-table projections (Phase 3). The source of truth is still
// `sync_<table>`. The `*_browse` table is a slim projection that lets the
// dashboard filter / sort on real columns instead of json_extract() on the
// whole payload. Rows are written in the same db.batch() as the source
// row so the projection is never more than one write behind.
// ---------------------------------------------------------------------------

const BROWSE_TABLE_NAME: Partial<Record<EntityTable, string>> = {
    categories: "categories_browse",
    manga: "manga_browse",
    chapters: "chapters_browse",
    tracks: "tracks_browse",
    histories: "histories_browse",
    updates: "updates_browse",
};

const BROWSE_PK_COLUMN: Partial<Record<EntityTable, string>> = {
    categories: "category_id",
    manga: "manga_id",
    chapters: "chapter_id",
    tracks: "track_id",
    histories: "history_id",
    updates: "update_id",
};

const BROWSE_UPSERT_SQL: Partial<Record<EntityTable, string>> = {
    chapters: `INSERT INTO chapters_browse (user_id, chapter_id, manga_id, name, is_read, is_bookmarked, date_upload, scanlator, last_page_read, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT(user_id, chapter_id)
       DO UPDATE SET manga_id = excluded.manga_id, name = excluded.name, is_read = excluded.is_read, is_bookmarked = excluded.is_bookmarked, date_upload = excluded.date_upload, scanlator = excluded.scanlator, last_page_read = excluded.last_page_read, payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at > chapters_browse.updated_at`,
    manga: `INSERT INTO manga_browse (user_id, manga_id, name, source, item_type, favorite, status, lang, last_update, date_added, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
       ON CONFLICT(user_id, manga_id)
       DO UPDATE SET name = excluded.name, source = excluded.source, item_type = excluded.item_type, favorite = excluded.favorite, status = excluded.status, lang = excluded.lang, last_update = excluded.last_update, date_added = excluded.date_added, payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at > manga_browse.updated_at`,
    tracks: `INSERT INTO tracks_browse (user_id, track_id, manga_id, sync_id, title, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(user_id, track_id)
       DO UPDATE SET manga_id = excluded.manga_id, sync_id = excluded.sync_id, title = excluded.title, payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at > tracks_browse.updated_at`,
    histories: `INSERT INTO histories_browse (user_id, history_id, manga_id, chapter_id, date, reading_time_seconds, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(user_id, history_id)
       DO UPDATE SET manga_id = excluded.manga_id, chapter_id = excluded.chapter_id, date = excluded.date, reading_time_seconds = excluded.reading_time_seconds, payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at > histories_browse.updated_at`,
    updates: `INSERT INTO updates_browse (user_id, update_id, manga_id, date, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(user_id, update_id)
       DO UPDATE SET manga_id = excluded.manga_id, date = excluded.date, payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at > updates_browse.updated_at`,
    categories: `INSERT INTO categories_browse (user_id, category_id, name, pos, for_item_type, hide, should_update, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(user_id, category_id)
       DO UPDATE SET name = excluded.name, pos = excluded.pos, for_item_type = excluded.for_item_type, hide = excluded.hide, should_update = excluded.should_update, payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.updated_at > categories_browse.updated_at`,
};

const BROWSE_COLUMNS_PER_ROW: Partial<Record<EntityTable, number>> = {
    chapters: 11,
    manga: 12,
    tracks: 7,
    histories: 8,
    updates: 6,
    categories: 9,
};

const MAX_BINDS_PER_STATEMENT = 100;

function browseRowsPerGroup(table: EntityTable): number {
    const browseCols = BROWSE_COLUMNS_PER_ROW[table];
    if (!browseCols) {
        return UPSERT_ROWS_PER_STATEMENT;
    }
    return Math.max(1, Math.floor(MAX_BINDS_PER_STATEMENT / browseCols));
}

function browseValuesFor(
    table: EntityTable,
    userId: string,
    id: number,
    entity: JsonObject,
    payload: string,
    updatedAt: number,
): Array<string | number> | null {
    switch (table) {
        case "chapters":
            return [
                userId,
                id,
                Math.trunc(toFiniteNumber(entity.mangaId) ?? 0),
                toStr(entity.name),
                toBool(entity.isRead) ? 1 : 0,
                toBool(entity.isBookmarked) ? 1 : 0,
                Math.trunc(toFiniteNumber(entity.dateUpload) ?? 0),
                toStr(entity.scanlator),
                toStr(entity.lastPageRead),
                payload,
                updatedAt,
            ];
        case "manga":
            return [
                userId,
                id,
                toStr(entity.name),
                toStr(entity.source),
                Math.trunc(toFiniteNumber(entity.itemType) ?? 0),
                toBool(entity.favorite) ? 1 : 0,
                Math.trunc(toFiniteNumber(entity.status) ?? 0),
                toStr(entity.lang),
                Math.trunc(toFiniteNumber(entity.lastUpdate) ?? 0),
                Math.trunc(toFiniteNumber(entity.dateAdded) ?? 0),
                payload,
                updatedAt,
            ];
        case "tracks":
            return [
                userId,
                id,
                Math.trunc(toFiniteNumber(entity.mangaId) ?? 0),
                Math.trunc(toFiniteNumber(entity.syncId) ?? 0),
                toStr(entity.title),
                payload,
                updatedAt,
            ];
        case "histories":
            return [
                userId,
                id,
                Math.trunc(toFiniteNumber(entity.mangaId) ?? 0),
                Math.trunc(toFiniteNumber(entity.chapterId) ?? 0),
                Math.trunc(toFiniteNumber(entity.date) ?? 0),
                Math.trunc(toFiniteNumber(entity.readingTimeSeconds) ?? 0),
                payload,
                updatedAt,
            ];
        case "updates":
            return [
                userId,
                id,
                Math.trunc(toFiniteNumber(entity.mangaId) ?? 0),
                Math.trunc(toFiniteNumber(entity.date) ?? 0),
                payload,
                updatedAt,
            ];
        case "categories":
            return [
                userId,
                id,
                toStr(entity.name),
                Math.trunc(toFiniteNumber(entity.pos) ?? 0),
                Math.trunc(toFiniteNumber(entity.forItemType) ?? 0),
                toBool(entity.hide) ? 1 : 0,
                toBool(entity.shouldUpdate) ? 1 : 0,
                payload,
                updatedAt,
            ];
        default:
            return null;
    }
}

export function browseTableName(table: EntityTable): string | null {
    return BROWSE_TABLE_NAME[table] ?? null;
}

export function browsePkColumn(table: EntityTable): string | null {
    return BROWSE_PK_COLUMN[table] ?? null;
}

export async function upsertEntity(db: D1Database, table: EntityTable, userId: string, entity: JsonObject): Promise<void> {
    const result = serializeEntity(table, entity, table);
    if ("error" in result) {
        throw new Error(result.error);
    }
    const sourceSql = `INSERT INTO ${tableName(table)} (user_id, entity_id, payload_json, updated_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, entity_id)
       DO UPDATE SET payload_json = excluded.payload_json,
                     updated_at   = excluded.updated_at
       WHERE excluded.updated_at > ${tableName(table)}.updated_at`;
    const statements: D1PreparedStatement[] = [
        db.prepare(sourceSql).bind(userId, result.id, result.payload, result.updatedAt),
    ];
    const browseSql = BROWSE_UPSERT_SQL[table];
    const browseValues = browseValuesFor(table, userId, result.id, entity, result.payload, result.updatedAt);
    if (browseSql && browseValues) {
        statements.push(db.prepare(browseSql).bind(...browseValues));
    }
    await db.batch(statements);
}

export async function upsertEntities(
    db: D1Database,
    table: EntityTable,
    userId: string,
    items: JsonObject[],
): Promise<UpsertEntityResult> {
    const result: UpsertEntityResult = { accepted: 0, rejected: 0, invalid: 0 };
    if (items.length === 0) {
        return result;
    }
    const valid: NormalizedEntity[] = [];
    const validEntities: JsonObject[] = [];
    for (let i = 0; i < items.length; i += 1) {
        const entity = items[i] as JsonObject;
        const serialized = serializeEntity(table, entity, `${table}[${i}]`);
        if ("error" in serialized) {
            result.invalid += 1;
            continue;
        }
        valid.push(serialized);
        validEntities.push(entity);
    }
    if (valid.length === 0) {
        return result;
    }

    const browseEnabled = BROWSE_UPSERT_SQL[table] != null;
    const rowsPerGroup = browseRowsPerGroup(table);
    // D1 allows up to 1000 statements per db.batch(). With dual-write each
    // group emits 2 statements (source + browse), so we cap the number of
    // groups per batch at 500. For tables without a browse projection we
    // fall back to the legacy 50-statement budget.
    const groupsPerBatch = browseEnabled ? 500 : 50;
    const statements: D1PreparedStatement[] = [];
    let groupsInBatch = 0;
    const flush = async (): Promise<void> => {
        if (statements.length === 0) return;
        await runBatched(db, statements);
        statements.length = 0;
        groupsInBatch = 0;
    };
    for (let i = 0; i < valid.length; i += rowsPerGroup) {
        const slice = valid.slice(i, i + rowsPerGroup);
        const entitySlice = validEntities.slice(i, i + rowsPerGroup);
        const groupStatements = buildUpsertStatements(db, table, userId, slice, entitySlice);
        for (const stmt of groupStatements) statements.push(stmt);
        groupsInBatch += 1;
        result.accepted += slice.length;
        if (groupsInBatch >= groupsPerBatch) {
            await flush();
        }
    }
    await flush();
    return result;
}

function buildUpsertStatements(
    db: D1Database,
    table: EntityTable,
    userId: string,
    rows: NormalizedEntity[],
    entities: JsonObject[],
): D1PreparedStatement[] {
    const statements: D1PreparedStatement[] = [];
    const browseEnabled = BROWSE_UPSERT_SQL[table] != null;
    const rowsPerGroup = browseRowsPerGroup(table);

    for (let i = 0; i < rows.length; i += rowsPerGroup) {
        const slice = rows.slice(i, i + rowsPerGroup);
        const entitySlice = entities.slice(i, i + rowsPerGroup);
        const valuesSql = slice.map(() => "(?," + "?," + "?," + "?)").join(",");
        const sql =
            `INSERT INTO ${tableName(table)} (user_id, entity_id, payload_json, updated_at) ` +
            `VALUES ${valuesSql} ` +
            `ON CONFLICT(user_id, entity_id) ` +
            `DO UPDATE SET payload_json = excluded.payload_json, ` +
            `              updated_at   = excluded.updated_at ` +
            `WHERE excluded.updated_at > ${tableName(table)}.updated_at`;
        const stmt = db.prepare(sql);
        const flat: Array<string | number> = [];
        for (const row of slice) {
            flat.push(userId, row.id, row.payload, row.updatedAt);
        }
        statements.push(stmt.bind(...flat));

        if (browseEnabled) {
            const browseSql = BROWSE_UPSERT_SQL[table]!;
            const browseColumns = BROWSE_COLUMNS_PER_ROW[table]!;
            const browseValuesSql = slice.map(() => `(${new Array(browseColumns).fill("?").join(",")})`).join(",");
            const browseStmtSql = browseSql.replace("VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)", `VALUES ${browseValuesSql}`)
                .replace("VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)", `VALUES ${browseValuesSql}`)
                .replace("VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)", `VALUES ${browseValuesSql}`)
                .replace("VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", `VALUES ${browseValuesSql}`)
                .replace("VALUES (?1, ?2, ?3, ?4, ?5, ?6)", `VALUES ${browseValuesSql}`)
                .replace("VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", `VALUES ${browseValuesSql}`);
            const browseStmt = db.prepare(browseStmtSql);
            const browseFlat: Array<string | number> = [];
            for (let j = 0; j < slice.length; j += 1) {
                const row = slice[j] as NormalizedEntity;
                const entity = entitySlice[j] as JsonObject;
                const values = browseValuesFor(table, userId, row.id, entity, row.payload, row.updatedAt);
                if (values) {
                    for (const v of values) browseFlat.push(v);
                }
            }
            statements.push(browseStmt.bind(...browseFlat));
        }
    }
    return statements;
}

export async function deleteEntitiesByIds(
    db: D1Database,
    table: EntityTable,
    userId: string,
    ids: number[],
): Promise<number> {
    const deduped = [...new Set(ids.map((value) => Math.trunc(value)).filter((value) => Number.isFinite(value)))];
    if (deduped.length === 0) {
        return 0;
    }
    const browseTable = BROWSE_TABLE_NAME[table];
    const browsePk = BROWSE_PK_COLUMN[table];
    const chunks = chunk(deduped, DELETE_IDS_PER_BATCH);
    let total = 0;
    for (const slice of chunks) {
        const statements: D1PreparedStatement[] = [];
        for (const idsChunk of chunk(slice, DELETE_IDS_PER_STATEMENT)) {
            const placeholdersSql = idsChunk.map(() => "?").join(",");
            statements.push(
                db
                    .prepare(`DELETE FROM ${tableName(table)} WHERE user_id = ? AND entity_id IN (${placeholdersSql})`)
                    .bind(userId, ...idsChunk),
            );
            if (browseTable && browsePk) {
                statements.push(
                    db
                        .prepare(`DELETE FROM ${browseTable} WHERE user_id = ? AND ${browsePk} IN (${placeholdersSql})`)
                        .bind(userId, ...idsChunk),
                );
            }
        }
        await runBatched(db, statements);
        total += slice.length;
    }
    return total;
}

export async function clearEntities(db: D1Database, table: EntityTable, userId: string): Promise<void> {
    const browseTable = BROWSE_TABLE_NAME[table];
    const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM ${tableName(table)} WHERE user_id = ?1`).bind(userId)];
    if (browseTable) {
        statements.push(db.prepare(`DELETE FROM ${browseTable} WHERE user_id = ?1`).bind(userId));
    }
    await db.batch(statements);
}

export interface SyncEntityResult extends UpsertEntityResult {
    deleted: number;
    cleared: boolean;
}

export async function syncEntityList(
    db: D1Database,
    table: Exclude<EntityTable, "settings">,
    userId: string,
    incoming: unknown,
    deletedIncoming: unknown,
    resetAll: boolean,
): Promise<JsonObject[]> {
    const items = toJsonArray(incoming, table);
    const deletedIds = Array.isArray(deletedIncoming)
        ? deletedIncoming.map((value) => toFiniteNumber(value)).filter((value): value is number => value !== null)
        : [];

    if (resetAll) {
        await clearEntities(db, table, userId);
    }
    await upsertEntities(db, table, userId, items);
    await deleteEntitiesByIds(db, table, userId, deletedIds);
    return listEntities(db, table, userId);
}

export interface SyncPagedResult {
    items: JsonObject[];
    nextCursor: number | null;
    total: number;
}

export async function syncEntityListPaged(
    db: D1Database,
    table: Exclude<EntityTable, "settings">,
    userId: string,
    incoming: unknown,
    deletedIncoming: unknown,
    resetAll: boolean,
    afterCursor: number | null,
    maxRows: number,
): Promise<SyncPagedResult> {
    const items = toJsonArray(incoming, table);
    const deletedIds = Array.isArray(deletedIncoming)
        ? deletedIncoming.map((value) => toFiniteNumber(value)).filter((value): value is number => value !== null)
        : [];

    if (resetAll) {
        await clearEntities(db, table, userId);
    }
    await upsertEntities(db, table, userId, items);
    await deleteEntitiesByIds(db, table, userId, deletedIds);

    const after = afterCursor ?? 0;
    const pageLimit = Math.min(maxRows, MAX_PAGE_LIMIT);
    const paged = await listEntitiesPaged(db, table, userId, {
        limit: pageLimit,
        after,
        sort: { field: "updatedAt", dir: "DESC" },
    });
    // Suppress the cursor when all rows fit within the cap — the caller
    // has received the complete dataset and doesn't need to page further.
    const fitsInCap = paged.total <= maxRows;
    return {
        items: paged.items,
        nextCursor: fitsInCap ? null : paged.nextCursor,
        total: paged.total,
    };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getSyncStats(db: D1Database, userId: string): Promise<SyncStats> {
    const statements = SYNC_TABLES.map((table) =>
        db.prepare(`SELECT COUNT(*) AS count FROM ${tableName(table)} WHERE user_id = ?1`).bind(userId),
    );
    const results = await runBatched(db, statements);
    const counts = results.map((result) => {
        const row = (result.results?.[0] as { count?: number } | undefined) ?? { count: 0 };
        return Number(row.count ?? 0);
    });
    return {
        categories: counts[0] ?? 0,
        manga: counts[1] ?? 0,
        chapters: counts[2] ?? 0,
        tracks: counts[3] ?? 0,
        histories: counts[4] ?? 0,
        updates: counts[5] ?? 0,
        settings: counts[6] ?? 0,
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runBatched(db: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
    if (statements.length === 0) {
        return [];
    }
    const result: D1Result[] = [];
    for (const slice of chunk(statements, STATEMENTS_PER_BATCH)) {
        const partial = await db.batch(slice);
        for (const item of partial) {
            result.push(item);
        }
    }
    return result;
}
