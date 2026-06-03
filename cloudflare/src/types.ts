export interface Env {
    DB: D1Database;
    JWT_SECRET: string;
    TOKEN_TTL_DAYS?: string;
    APP_NAME?: string;
    AUTH_COOKIE_NAME?: string;
    AUTH_ISSUER?: string;
    MAX_REQUEST_BODY_BYTES?: string;
}

export type JsonObject = Record<string, unknown>;

export interface CredentialsBody {
    email?: unknown;
    password?: unknown;
}

export interface UpdateProfileBody extends CredentialsBody {
    passwordOld?: unknown;
}

export interface SyncItem extends JsonObject {
    id?: unknown;
    updatedAt?: unknown;
}

export interface MangaSyncBody {
    categories?: unknown;
    deleted_categories?: unknown;
    manga?: unknown;
    deleted_manga?: unknown;
    chapters?: unknown;
    deleted_chapters?: unknown;
    tracks?: unknown;
    deleted_tracks?: unknown;
    after_categories?: unknown;
    after_manga?: unknown;
    after_chapters?: unknown;
    after_tracks?: unknown;
    resetAll?: unknown;
}

export interface HistorySyncBody {
    histories?: unknown;
    deleted_histories?: unknown;
    after_histories?: unknown;
    resetAll?: unknown;
}

export interface UpdateSyncBody {
    updates?: unknown;
    deleted_updates?: unknown;
    after_updates?: unknown;
    resetAll?: unknown;
}

export interface SettingsWrapper {
    settings?: unknown;
}

export const SYNC_ENTITY_KEYS = [
    "categories",
    "manga",
    "chapters",
    "tracks",
    "histories",
    "updates",
    "settings",
] as const;

export type SyncEntityKey = (typeof SYNC_ENTITY_KEYS)[number];

export type PageId =
    | "home"
    | "register"
    | "login"
    | "profile"
    | "settings"
    | "library"
    | "history"
    | "updates"
    | "tracking"
    | "categories"
    | "chapters"
    | "stats";

export const PAGE_IDS: readonly PageId[] = [
    "home",
    "register",
    "login",
    "profile",
    "settings",
    "library",
    "history",
    "updates",
    "tracking",
    "categories",
    "chapters",
    "stats",
] as const;

export function isPageId(value: string): value is PageId {
    return (PAGE_IDS as readonly string[]).includes(value);
}
