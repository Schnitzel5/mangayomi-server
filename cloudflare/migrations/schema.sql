-- Mangayomi Cloudflare Worker schema.
-- Source of truth for the entire storage layer. Code references these
-- table and column names directly.

-- ================================================================
-- Core sync tables
-- ================================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS sync_categories (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_categories_user_idx ON sync_categories (user_id);

CREATE TABLE IF NOT EXISTS sync_manga (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_manga_user_idx ON sync_manga (user_id);

CREATE TABLE IF NOT EXISTS sync_chapters (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_chapters_user_idx ON sync_chapters (user_id);

CREATE TABLE IF NOT EXISTS sync_tracks (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_tracks_user_idx ON sync_tracks (user_id);

CREATE TABLE IF NOT EXISTS sync_histories (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_histories_user_idx ON sync_histories (user_id);

CREATE TABLE IF NOT EXISTS sync_updates (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_updates_user_idx ON sync_updates (user_id);

CREATE TABLE IF NOT EXISTS sync_settings (
  user_id      TEXT    NOT NULL,
  entity_id    INTEGER NOT NULL DEFAULT 227,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS sync_settings_user_idx ON sync_settings (user_id);

-- ================================================================
-- Browse projection tables (dashboard reads)
-- ================================================================

CREATE TABLE IF NOT EXISTS chapters_browse (
  user_id        TEXT    NOT NULL,
  chapter_id     INTEGER NOT NULL,
  manga_id       INTEGER NOT NULL,
  name           TEXT    NOT NULL,
  is_read        INTEGER NOT NULL,
  is_bookmarked  INTEGER NOT NULL,
  date_upload    INTEGER NOT NULL,
  scanlator      TEXT    NOT NULL,
  last_page_read TEXT    NOT NULL,
  payload_json   TEXT    NOT NULL,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS chapters_browse_manga_idx
    ON chapters_browse (user_id, manga_id, date_upload DESC);
CREATE INDEX IF NOT EXISTS chapters_browse_manga_id_idx
    ON chapters_browse (user_id, manga_id, chapter_id);
CREATE INDEX IF NOT EXISTS chapters_browse_read_idx
    ON chapters_browse (user_id, manga_id, is_read);
CREATE INDEX IF NOT EXISTS chapters_browse_user_idx
    ON chapters_browse (user_id);

CREATE TABLE IF NOT EXISTS manga_browse (
  user_id     TEXT    NOT NULL,
  manga_id    INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  source      TEXT    NOT NULL,
  item_type   INTEGER NOT NULL,
  favorite    INTEGER NOT NULL,
  status      INTEGER NOT NULL,
  lang        TEXT    NOT NULL,
  last_update INTEGER NOT NULL,
  date_added  INTEGER NOT NULL,
  payload_json TEXT   NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, manga_id)
);

CREATE INDEX IF NOT EXISTS manga_browse_user_idx
    ON manga_browse (user_id);
CREATE INDEX IF NOT EXISTS manga_browse_date_added_idx
    ON manga_browse (user_id, date_added DESC);

CREATE TABLE IF NOT EXISTS tracks_browse (
  user_id         TEXT    NOT NULL,
  track_id        INTEGER NOT NULL,
  manga_id        INTEGER NOT NULL,
  sync_id         INTEGER NOT NULL,
  title           TEXT    NOT NULL,
  payload_json    TEXT    NOT NULL,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, track_id)
);

CREATE INDEX IF NOT EXISTS tracks_browse_manga_idx
    ON tracks_browse (user_id, manga_id);

CREATE TABLE IF NOT EXISTS histories_browse (
  user_id              TEXT    NOT NULL,
  history_id           INTEGER NOT NULL,
  manga_id             INTEGER NOT NULL,
  chapter_id           INTEGER NOT NULL,
  date                 INTEGER NOT NULL,
  reading_time_seconds INTEGER NOT NULL,
  payload_json         TEXT    NOT NULL,
  updated_at           INTEGER NOT NULL,
  PRIMARY KEY (user_id, history_id)
);

CREATE INDEX IF NOT EXISTS histories_browse_manga_idx
    ON histories_browse (user_id, manga_id, date DESC);

CREATE TABLE IF NOT EXISTS updates_browse (
  user_id      TEXT    NOT NULL,
  update_id    INTEGER NOT NULL,
  manga_id     INTEGER NOT NULL,
  date         INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, update_id)
);

CREATE INDEX IF NOT EXISTS updates_browse_manga_idx
    ON updates_browse (user_id, manga_id, date DESC);

CREATE TABLE IF NOT EXISTS categories_browse (
  user_id      TEXT    NOT NULL,
  category_id  INTEGER NOT NULL,
  name         TEXT    NOT NULL,
  pos          INTEGER NOT NULL,
  for_item_type INTEGER NOT NULL,
  hide         INTEGER NOT NULL,
  should_update INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS categories_browse_user_idx
    ON categories_browse (user_id);

-- ================================================================
-- Backfill browse projections from sync tables.
-- Idempotent: INSERT OR IGNORE keeps this safe to re-run.
-- ================================================================

INSERT OR IGNORE INTO categories_browse (
    user_id, category_id, name, pos, for_item_type, hide, should_update, payload_json, updated_at
)
SELECT
    user_id,
    entity_id,
    COALESCE(json_extract(payload_json, '$.name'), ''),
    COALESCE(json_extract(payload_json, '$.pos'), 0),
    COALESCE(json_extract(payload_json, '$.forItemType'), 0),
    CASE
        WHEN json_extract(payload_json, '$.hide') = 1 OR json_extract(payload_json, '$.hide') = 'true'
            THEN 1 ELSE 0
    END,
    CASE
        WHEN json_extract(payload_json, '$.shouldUpdate') = 1 OR json_extract(payload_json, '$.shouldUpdate') = 'true'
            THEN 1 ELSE 0
    END,
    payload_json,
    updated_at
FROM sync_categories;

INSERT OR IGNORE INTO manga_browse (
    user_id, manga_id, name, source, item_type, favorite, status, lang, last_update, date_added, payload_json, updated_at
)
SELECT
    user_id,
    entity_id,
    COALESCE(json_extract(payload_json, '$.name'), ''),
    COALESCE(json_extract(payload_json, '$.source'), ''),
    COALESCE(json_extract(payload_json, '$.itemType'), 0),
    CASE
        WHEN json_extract(payload_json, '$.favorite') = 1 OR json_extract(payload_json, '$.favorite') = 'true'
            THEN 1 ELSE 0
    END,
    COALESCE(json_extract(payload_json, '$.status'), 0),
    COALESCE(json_extract(payload_json, '$.lang'), ''),
    COALESCE(json_extract(payload_json, '$.lastUpdate'), 0),
    COALESCE(json_extract(payload_json, '$.dateAdded'), 0),
    payload_json,
    updated_at
FROM sync_manga;

INSERT OR IGNORE INTO chapters_browse (
    user_id, chapter_id, manga_id, name, is_read, is_bookmarked, date_upload, scanlator, last_page_read, payload_json, updated_at
)
SELECT
    user_id,
    entity_id,
    COALESCE(json_extract(payload_json, '$.mangaId'), 0),
    COALESCE(json_extract(payload_json, '$.name'), ''),
    CASE
        WHEN json_extract(payload_json, '$.isRead') = 1 OR json_extract(payload_json, '$.isRead') = 'true'
            THEN 1 ELSE 0
    END,
    CASE
        WHEN json_extract(payload_json, '$.isBookmarked') = 1 OR json_extract(payload_json, '$.isBookmarked') = 'true'
            THEN 1 ELSE 0
    END,
    COALESCE(json_extract(payload_json, '$.dateUpload'), 0),
    COALESCE(json_extract(payload_json, '$.scanlator'), ''),
    COALESCE(json_extract(payload_json, '$.lastPageRead'), ''),
    payload_json,
    updated_at
FROM sync_chapters;

INSERT OR IGNORE INTO tracks_browse (
    user_id, track_id, manga_id, sync_id, title, payload_json, updated_at
)
SELECT
    user_id,
    entity_id,
    COALESCE(json_extract(payload_json, '$.mangaId'), 0),
    COALESCE(json_extract(payload_json, '$.syncId'), 0),
    COALESCE(json_extract(payload_json, '$.title'), ''),
    payload_json,
    updated_at
FROM sync_tracks;

INSERT OR IGNORE INTO histories_browse (
    user_id, history_id, manga_id, chapter_id, date, reading_time_seconds, payload_json, updated_at
)
SELECT
    user_id,
    entity_id,
    COALESCE(json_extract(payload_json, '$.mangaId'), 0),
    COALESCE(json_extract(payload_json, '$.chapterId'), 0),
    COALESCE(json_extract(payload_json, '$.date'), 0),
    COALESCE(json_extract(payload_json, '$.readingTimeSeconds'), 0),
    payload_json,
    updated_at
FROM sync_histories;

INSERT OR IGNORE INTO updates_browse (
    user_id, update_id, manga_id, date, payload_json, updated_at
)
SELECT
    user_id,
    entity_id,
    COALESCE(json_extract(payload_json, '$.mangaId'), 0),
    COALESCE(json_extract(payload_json, '$.date'), 0),
    payload_json,
    updated_at
FROM sync_updates;
