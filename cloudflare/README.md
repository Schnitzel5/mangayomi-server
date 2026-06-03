# Mangayomi Cloudflare Worker

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/Schnitzel5/mangayomi-server/tree/main/cloudflare)

Click the button above to deploy instantly. Cloudflare will:
1. Fork the full repo to your GitHub (only the `cloudflare/` folder is used for deployment)
2. Create a D1 database automatically
3. Prompt you for a `JWT_SECRET` (paste any 64-character random string)
4. Deploy the worker

No command line required. Point the Mangayomi Flutter client at the deployed URL and you're done.

---

A stateless, serverless deployment of the [Mangayomi sync server](../README.md).
Drop in the URL in the Mangayomi Flutter client and your library, history,
updates, and settings sync to Cloudflare D1 — no Docker, no MongoDB, no VPS.

The HTTP contract (URLs, request/response bodies, status codes) is
**byte-compatible** with the [Rust reference server](../), so the
[official Mangayomi client](https://github.com/kodjodevf/mangayomi) works
without any modifications.

## Stack

- [Cloudflare Workers](https://workers.cloudflare.com/) (HTTP runtime)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge)
- [Hono](https://hono.dev/) (router)
- [hash-wasm](https://github.com/Daninet/hash-wasm) (Argon2id verification for legacy accounts)
- Web Crypto API (PBKDF2-SHA256 for new accounts, HS256 JWTs)
- [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/) (dashboard styling, prebuilt to a single CSS file)

## Prerequisites

- A Cloudflare account
- `wrangler` 4.x (`npm install -g wrangler` or use the local dev dep)
- Node 18+ (only needed for the `npm` build step; the deployed Worker uses the Workers runtime)

## Setup

```bash
cd cloudflare
npm install
```

### 1. Create the D1 database

```bash
wrangler d1 create mangayomi_sync
```

Copy the printed `database_id` into [`wrangler.toml`](./wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "mangayomi_sync"
database_id = "<paste the id here>"
```

### 2. Apply the schema

Local D1 (for `wrangler dev`):

```bash
npm run migrations:local
```

Remote D1 (production):

```bash
npm run migrations:remote
```

The schema is defined in [`migrations/0001_init.sql`](./migrations/0001_init.sql)
and is the source of truth for table and column names used by `src/db.ts`.

### 3. Set the JWT secret

```bash
wrangler secret put JWT_SECRET
# paste a random 64-byte string, e.g. the output of:
#   openssl rand -base64 64
```

For local development, `.dev.vars` holds a fallback `JWT_SECRET` (key=value
format, not JSON). **Do not commit `.dev.vars`** — it is already in
`.gitignore`. For production, use `wrangler secret put JWT_SECRET`.

You can also set non-secret vars in `wrangler.toml`. The defaults are:

| Var | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `Mangayomi Sync` | Title shown on the dashboard |
| `TOKEN_TTL_DAYS` | `30` | JWT lifetime in days |
| `AUTH_COOKIE_NAME` | `id` | Cookie name (must be `id` to match the Flutter client) |
| `AUTH_ISSUER` | `mangayomi-cloudflare` | JWT `iss` claim |
| `JWT_SECRET` | (secret) | HS256 signing key — **set with `wrangler secret put`** |

### 4. Run locally

```bash
npm run dev
```

`npm run dev` automatically runs `npm run build:css` first (via the `predev`
hook) so the prebuilt stylesheet in `public/styles.css` is always up to date
before the worker boots. It starts a local D1 SQLite instance and the worker
on `http://127.0.0.1:8787`. Useful one-liners:

```bash
# Register
curl -i -X POST http://127.0.0.1:8787/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"hunter22hunter22"}' \
  -c cookies.txt

# Login (sets the id cookie)
curl -i -X POST http://127.0.0.1:8787/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"hunter22hunter22"}' \
  -c cookies.txt

# Sync manga (uses Cookie: id=… from the previous call)
curl -i -X POST http://127.0.0.1:8787/sync/manga \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"categories":[],"deleted_categories":[],"manga":[],"deleted_manga":[],"chapters":[],"deleted_chapters":[],"tracks":[],"deleted_tracks":[]}'

# Read-only entity browsers (used by the dashboard UI)
curl -i http://127.0.0.1:8787/sync/manga      -b cookies.txt
curl -i http://127.0.0.1:8787/sync/categories -b cookies.txt
curl -i http://127.0.0.1:8787/sync/settings   -b cookies.txt

# Open the dashboard in a browser
open http://127.0.0.1:8787/
```

### 5. Deploy

```bash
npm run deploy
```

`npm run deploy` automatically runs `npm run build:css` first (via the
`predeploy` hook). `wrangler` will print the worker URL
(`https://mangayomi-cloudflare.<your-subdomain>.workers.dev`). Point the
Mangayomi Flutter client at that URL.

## Routes

### Auth
- `POST /register` — `{email, password}` → 200 + auth headers, 400 if invalid, 200 plain text if account exists
- `POST /login` — `{email, password}` → 200 + auth headers, 200 plain text "Account not found …" on failure (matches the Rust contract)
- `POST /profile` — `{email, password, passwordOld}` → 200 + new auth headers
- `GET /logout` — clears the `id` cookie
- `DELETE /delete` — deletes the account and all rows they own
- `GET /me` — current user JSON, 401 if not authenticated

### Sync (POST, write; GET, read-only browser)
| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `GET`  | `/health` | — | Liveness probe: `{ok, service, timestamp}` |
| `GET`  | `/stats` | — | Row counts for the signed-in user |
| `GET`  | `/sync/categories` | — | List of categories |
| `GET`  | `/sync/manga` | — | List of manga (id, name, source, updatedAt) |
| `GET`  | `/sync/chapters` | — | List of chapters |
| `GET`  | `/sync/tracks` | — | List of track records |
| `GET`  | `/sync/histories` | — | List of history entries |
| `GET`  | `/sync/updates` | — | List of update entries |
| `GET`  | `/sync/settings` | — | Current settings row (auto-creates a default if missing) |
| `POST` | `/sync/manga` | full payload | Upsert categories, manga, chapters, tracks |
| `POST` | `/sync/histories` | full payload | Upsert history rows |
| `POST` | `/sync/updates` | full payload | Upsert update rows |

All `GET /sync/*` routes are auth-gated and return the **same JSON shape** the
Flutter client expects on the POST counterparts. The dashboard uses them to
render the read-only entity browsers.

### Dashboard (HTML)
- `GET /` → server-renders the **Home** page, then the SPA takes over.
- `GET /web` → same as `/`.
- `GET /web/{home|profile|library|history|updates|tracking|categories|chapters|settings|stats}` → server-renders the requested page (deep links work without JS).
- `GET /web/*` → server-renders the **Home** page as a catch-all.

Pages: Home (welcome + cards), Profile, Library, History, Updates, Tracking,
Categories, Chapters, Settings, Stats. Categories/Chapters/Stats are backed
by the new `GET /sync/*` endpoints; the others are static placeholders
matching the Angular frontend's pages.

## How it differs from the Rust server

| Concern | Rust server (`src/`) | Cloudflare worker (`cloudflare/`) |
| --- | --- | --- |
| Runtime | Actix-web on a long-lived host | Cloudflare Workers (V8 isolate, edge) |
| Database | MongoDB | Cloudflare D1 (SQLite) |
| Auth | `actix-identity` + `actix-session` (cookie + Mongo ObjectId) | HS256 JWT in the `id` cookie (and `Authorization: Bearer` header) |
| Password hashing | Argon2id (PHC string) | **PBKDF2-SHA256** (210,000 iterations) for new users; **Argon2id is still verified on login** for legacy accounts and transparently re-hashed |
| Sync | One Mongo `bulk_write` per request | Batched D1 `INSERT … ON CONFLICT` (up to 1000 statements per `db.batch`, multi-row `VALUES`) |
| Rate limit | `actix-governor` (30 req/min, burst 15) | None — rely on Cloudflare's edge protection |
| Frontend | Angular SPA (`frontend/`) | Single-page HTML served from the worker (`src/ui.ts`), styled with Tailwind + DaisyUI, themes `coffee` and `dark` |
| Body size | 250 MB (`JsonConfig::default().limit(250 << 20)`) | 1 MB per D1 parameter; chunked upserts in batches of 1000 rows |

### Backwards compatibility

- All sync endpoints (`/sync/manga`, `/sync/histories`, `/sync/updates`, `/sync/settings`)
  accept and return the **exact same JSON shape** as the Rust server.
- The `id` cookie is set on register/login and cleared on logout/delete, exactly
  as the Flutter client expects.
- The conflict-resolution semantics (newest `updatedAt` wins) match the original
  Rust `bulk_write` filter (`updatedAt: { $lt: incoming }`).
- The settings record is stored under entity id `227` (the Flutter client's
  Isar key); other entity ids in the `settings` payload are accepted as-is.

### Password format note

New accounts are hashed with PBKDF2-SHA256 (210,000 iterations, 16-byte salt,
PHC-style encoding `pbkdf2$sha256$210000$<salt>$<hash>`). If you import an
existing account from the Rust server, its Argon2id hash is still verified on
login (via `hash-wasm`) and the row is silently upgraded to PBKDF2.

### Sync payload size

D1 caps each bound parameter at ~1 MB and each `db.batch` call at 1000
statements. The worker:

- Rejects individual items whose serialised JSON exceeds 1 MB with `400`.
- Chunks upserts at 20 rows per `INSERT` (4 params × 20 = 80) × 50 statements
  per `db.batch` = 1000 rows per call.
- Chunks deletes at 50 ids per `DELETE` × 20 statements = 1000 ids per call.

A 250 MB request body, in the worst case, traverses a few hundred batched
D1 round-trips. This is bounded by the worker's memory (~128 MB) rather than
by the protocol.

### Restore protocol (large datasets)

The POST `/sync/*` endpoints return at most **50 000 rows per list** in the
response, ordered by `updatedAt` descending (most recently modified first).
This keeps responses under ~50 MB JSON and avoids hitting Cloudflare's
response-size limits.

The response includes two additive fields the Flutter client ignores:

- `nextCursor.<table>` — `null` if all rows fit; otherwise the cursor to
  pass as `after_<table>` in the next POST to fetch the next page.
- `total.<table>` — full row count, so the caller knows remaining work.

#### Body size limit

| Plan | Worker body limit | `MAX_REQUEST_BODY_BYTES` default |
|------|-------------------|----------------------------------|
| Free | 10 MB | `""` (10 MB) |
| Paid ($5/mo) | 100 MB | Set to `"104857600"` |

Override via `[vars]` in `wrangler.toml` or as a Cloudflare secret.

#### Chunked restore recipe

```bash
# Register / login
curl -i -X POST http://127.0.0.1:8787/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"yourpassword"}' \
  -c cookies.txt

# First chunk (resetAll clears existing data)
curl -i -X POST http://127.0.0.1:8787/sync/manga \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d @chunk1.json
# Response has nextCursor.chapters — note the value

# Next chunk (send after_chapters cursor)
curl -i -X POST http://127.0.0.1:8787/sync/manga \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d "{\"chapters\":$(cat chunk2.json),\"after_chapters\":<cursor>}"
```

Or use the automated test script:

```bash
node scripts/load-test-restore.mjs \
  --url http://127.0.0.1:8787 \
  --email you@example.com \
  --password yourpassword
```

#### Flutter client compatibility

The `after_*`, `nextCursor`, and `total` fields are additive and optional.
The Flutter client ignores unknown JSON keys, so its sync behaviour is
unchanged. The 50K-row response cap means the Flutter client's full-echo
behaviour is limited to the 50K most recently modified entries per table.
For users with >50K rows this is a known reduction; the full dataset is
still stored server-side and accessible via `GET /sync/{table}` with
keyset pagination.

## Project layout

```
cloudflare/
├── wrangler.toml            # Worker + D1 binding, CSS text-loader rule
├── package.json             # hono, hash-wasm, wrangler, tailwindcss, daisyui
├── tsconfig.json            # strict TS for Workers
├── tailwind.config.cjs      # content globs + daisyui plugin
├── postcss.config.cjs       # Tailwind + autoprefixer
├── migrations/
│   ├── 0001_init.sql        # D1 schema (source of truth)
│   └── 0002_browse_tables.sql  # Slim projection tables for dashboard
├── scripts/
│   ├── backfill-browse.sql  # One-shot backfill for browse tables
│   └── load-test-restore.mjs  # 300K-chapter restore test script
├── public/
│   └── styles.css           # Prebuilt, minified CSS (inlined into the HTML, not served)
└── src/
    ├── index.ts             # Hono app: all routes, GET /sync/* entity browsers
    ├── types.ts             # Worker env + request body types + PageId union
    ├── auth.ts              # JWT, password hashing, cookie helpers
    ├── db.ts                # D1 storage layer (batched upserts, deletes, stats, pagination)
    ├── ui.ts                # Single-file HTML dashboard (DaisyUI, all 10 pages)
    ├── styles.css           # Tailwind input + custom @layer components
    └── cloudflare.d.ts      # Minimal D1 + CSS module type shim
```

The dashboard CSS is prebuilt with `npm run build:css` (invoked automatically
by the `predev` and `predeploy` hooks) into `public/styles.css`. The worker
imports it as a string via the Text loader declared in `wrangler.toml` and
inlines it directly into the served HTML — no extra HTTP request, no
CDN dependency, no runtime CSS-in-JS cost.

## Useful commands

```bash
npm run typecheck          # tsc --noEmit
npm run build:css          # build Tailwind + DaisyUI into public/styles.css
npm run dev                # predev hook rebuilds CSS, then wrangler dev (local D1)
npm run deploy             # predeploy hook rebuilds CSS, then wrangler deploy
npm run migrations:local   # apply schema to local D1
npm run migrations:remote  # apply schema to remote D1
node scripts/load-test-restore.mjs  # synthetic 300K-chapter restore test
```

## License

This worker is part of the same project as the Rust server; see the top-level
[`LICENSE`](../LICENSE).
