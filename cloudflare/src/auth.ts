import { argon2Verify } from "hash-wasm";

export interface EnvLike {
    APP_NAME?: string;
    AUTH_COOKIE_NAME?: string;
    AUTH_ISSUER?: string;
    TOKEN_TTL_DAYS?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH_BITS = 256;
const PBKDF2_SALT_BYTES = 16;
const ARGON2_PREFIX = "$argon2";
const DEFAULT_COOKIE_NAME = "id";
const DEFAULT_ISSUER = "mangayomi-cloudflare";
const DEFAULT_TTL_DAYS = 30;
const DEFAULT_TTL_SECONDS = DEFAULT_TTL_DAYS * 24 * 60 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface JwtPayload {
    sub: string;
    iss: string;
    iat: number;
    exp: number;
}

const hmacKeyCache = new Map<string, Promise<CryptoKey>>();

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const remainder = padded.length % 4;
    const base64 = remainder === 0 ? padded : padded + "=".repeat(4 - remainder);
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return diff === 0;
}

function freshBytes(length: number): Uint8Array<ArrayBuffer> {
    const buffer = new ArrayBuffer(length);
    const bytes = new Uint8Array(buffer);
    crypto.getRandomValues(bytes);
    return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
    const cached = hmacKeyCache.get(secret);
    if (cached) {
        return cached;
    }
    const keyPromise = crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
    hmacKeyCache.set(secret, keyPromise);
    return keyPromise;
}

async function derivePbkdf2Bits(
    password: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        keyMaterial,
        PBKDF2_HASH_BITS,
    );
    return new Uint8Array(bits);
}

function encodeJwtPart(value: unknown): string {
    return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
}

export function isValidPassword(password: string): boolean {
    return typeof password === "string" && password.length >= 8;
}

export function normalizeEmail(value: string): string {
    return value.trim();
}

export function isLegacyHash(encoded: string): boolean {
    return encoded.startsWith(ARGON2_PREFIX);
}

export async function hashPassword(password: string): Promise<string> {
    const salt = freshBytes(PBKDF2_SALT_BYTES);
    const digest = await derivePbkdf2Bits(password, salt, PBKDF2_ITERATIONS);
    return ["pbkdf2", "sha256", String(PBKDF2_ITERATIONS), bytesToBase64Url(salt), bytesToBase64Url(digest)].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
    if (isLegacyHash(encoded)) {
        try {
            return await argon2Verify({ password, hash: encoded });
        } catch {
            return false;
        }
    }

    const [algorithm, hashName, iterationsRaw, saltRaw, digestRaw] = encoded.split("$");
    if (algorithm !== "pbkdf2" || hashName !== "sha256") {
        return false;
    }
    const iterations = Number.parseInt(iterationsRaw ?? "", 10);
    if (!Number.isFinite(iterations) || iterations <= 0) {
        return false;
    }
    try {
        const salt = base64UrlToBytes(saltRaw ?? "");
        const expected = base64UrlToBytes(digestRaw ?? "");
        const actual = await derivePbkdf2Bits(password, salt, iterations);
        return timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

export async function signJwt(secret: string, payload: JwtPayload): Promise<string> {
    const header = { alg: "HS256", typ: "JWT" };
    const unsigned = `${encodeJwtPart(header)}.${encodeJwtPart(payload)}`;
    const signature = await crypto.subtle.sign(
        "HMAC",
        await importHmacKey(secret),
        encoder.encode(unsigned),
    );
    return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyJwt(secret: string, token: string): Promise<JwtPayload | null> {
    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }
    const [headerPart, payloadPart, signaturePart] = parts;
    if (!headerPart || !payloadPart || !signaturePart) {
        return null;
    }
    try {
        const header = JSON.parse(decoder.decode(base64UrlToBytes(headerPart))) as {
            alg?: string;
            typ?: string;
        };
        if (header.alg !== "HS256" || header.typ !== "JWT") {
            return null;
        }

        const unsigned = `${headerPart}.${payloadPart}`;
        const signature = base64UrlToBytes(signaturePart);
        const expected = new Uint8Array(
            await crypto.subtle.sign("HMAC", await importHmacKey(secret), encoder.encode(unsigned)),
        );
        if (!timingSafeEqual(signature, expected)) {
            return null;
        }

        const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadPart))) as Partial<JwtPayload>;
        if (!payload.sub || !payload.iss || !payload.iat || !payload.exp) {
            return null;
        }
        if (payload.exp * 1000 <= Date.now()) {
            return null;
        }
        return payload as JwtPayload;
    } catch {
        return null;
    }
}

export function getCookieName(env: EnvLike): string {
    return env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;
}

export function getIssuer(env: EnvLike): string {
    return env.AUTH_ISSUER?.trim() || DEFAULT_ISSUER;
}

export function getTokenTtlSeconds(env: EnvLike): number {
    const parsed = Number.parseInt(env.TOKEN_TTL_DAYS ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed * 24 * 60 * 60;
    }
    return DEFAULT_TTL_SECONDS;
}

export function getTokenFromRequest(request: Request, cookieName = DEFAULT_COOKIE_NAME): string | null {
    const authorization = request.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
        const candidate = authorization.slice(7).trim();
        if (candidate) {
            return candidate;
        }
    }

    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) {
        return null;
    }
    for (const part of cookieHeader.split(";")) {
        const trimmed = part.trim();
        const eq = trimmed.indexOf("=");
        if (eq === -1) {
            continue;
        }
        const key = trimmed.slice(0, eq);
        if (key === cookieName) {
            const value = trimmed.slice(eq + 1);
            if (value) {
                return value;
            }
        }
    }
    return null;
}

export function buildAuthCookie(env: EnvLike, token: string, secure: boolean): string {
    const cookieName = getCookieName(env);
    const ttl = getTokenTtlSeconds(env);
    const parts = [
        `${cookieName}=${token}`,
        "Path=/",
        `Max-Age=${ttl}`,
        "HttpOnly",
        "SameSite=Strict",
    ];
    if (secure) {
        parts.push("Secure");
    }
    return parts.join("; ");
}

export function buildExpiredAuthCookie(env: EnvLike, secure: boolean): string {
    const cookieName = getCookieName(env);
    const parts = [`${cookieName}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Strict"];
    if (secure) {
        parts.push("Secure");
    }
    return parts.join("; ");
}

export function isSecureRequest(request: Request): boolean {
    return new URL(request.url).protocol === "https:";
}

export interface AuthHeaders {
    headers: Headers;
    token: string;
}

export async function issueAuthHeaders(env: EnvLike & { JWT_SECRET: string }, userId: string, secure: boolean): Promise<AuthHeaders> {
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(env.JWT_SECRET, {
        sub: userId,
        iss: getIssuer(env),
        iat: now,
        exp: now + getTokenTtlSeconds(env),
    });
    const headers = new Headers();
    headers.set("Set-Cookie", buildAuthCookie(env, token, secure));
    headers.set("X-Auth-Token", token);
    headers.set("Cache-Control", "no-store");
    return { headers, token };
}

export function clearAuthHeaders(env: EnvLike, secure: boolean): Headers {
    const headers = new Headers();
    headers.set("Set-Cookie", buildExpiredAuthCookie(env, secure));
    headers.set("X-Auth-Token", "");
    headers.set("Cache-Control", "no-store");
    return headers;
}
