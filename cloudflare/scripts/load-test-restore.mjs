#!/usr/bin/env node
// load-test-restore.mjs
// Synthetic 300K-chapter restore test for the Cloudflare Worker.
// Generates 300K chapters (+ manga + categories + tracks), POSTs them in
// chunks using after_* cursors, then verifies via GET.
//
// Usage:
//   node scripts/load-test-restore.mjs --url http://127.0.0.1:8787 --email test@example.com --password password1234
//
// No npm dependencies — uses built-in fetch (Node 18+).

import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url:     { type: "string", default: "http://127.0.0.1:8787" },
    email:   { type: "string", default: "test@example.com" },
    password:{ type: "string", default: "password1234" },
    chapters:{ type: "string", default: "300000" },
    chunk:   { type: "string", default: "60000" },
  },
  strict: false,
});

const BASE     = args.url.replace(/\/+$/, "");
const EMAIL    = args.email;
const PASSWORD = args.password;
const TOTAL_CHAPTERS = Number.parseInt(args.chapters, 10);
const CHUNK_SIZE     = Number.parseInt(args.chunk, 10);

let passed = 0;
let failed = 0;
let cookie = null;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

async function request(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const m = setCookie.match(/^(id=[^;]+)/);
    if (m) cookie = m[1];
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json };
}

// --- Fixtures -----------------------------------------------------------

function makeCategories() {
  const cats = [];
  for (let i = 1; i <= 50; i++) {
    cats.push({
      id: i,
      name: `Category ${i}`,
      forItemType: 0,
      pos: i,
      hide: false,
      shouldUpdate: true,
      updatedAt: Date.now() - (50 - i) * 1000,
    });
  }
  return cats;
}

function makeManga(count) {
  const manga = [];
  for (let i = 1; i <= count; i++) {
    manga.push({
      id: i,
      name: `Manga ${String(i).padStart(6, "0")}`,
      link: `/manga/${i}`,
      imageUrl: `https://example.com/${i}.jpg`,
      description: `Description for manga ${i}`,
      author: "Author",
      artist: "Artist",
      status: i % 3,
      favorite: i % 5 === 0,
      source: "test-source",
      lang: "en",
      dateAdded: Date.now() - (count - i) * 60_000,
      lastUpdate: Date.now() - (count - i) * 1000,
      itemType: 0,
      updatedAt: Date.now() - (count - i) * 1000,
    });
  }
  return manga;
}

function makeChapters(mangaCount, chapterCount) {
  const chapters = [];
  for (let i = 1; i <= chapterCount; i++) {
    const mangaId = (i % mangaCount) + 1;
    chapters.push({
      id: 1000000 + i,
      name: `Chapter ${i}`,
      mangaId,
      dateUpload: String(Date.now() - (chapterCount - i) * 60_000),
      isRead: false,
      isBookmarked: false,
      scanlator: "",
      lastPageRead: "",
      updatedAt: Date.now() - (chapterCount - i) * 1000,
    });
  }
  return chapters;
}

function makeTracks(mangaCount) {
  const tracks = [];
  for (let i = 1; i <= mangaCount; i++) {
    if (i % 3 !== 0) continue;
    tracks.push({
      id: 2000000 + i,
      mangaId: i,
      syncId: 1,
      title: `Track for manga ${i}`,
      score: null,
      status: null,
      lastChapterRead: 0,
      trackingUrl: "",
      updatedAt: Date.now() - i * 1000,
    });
  }
  return tracks;
}

// --- Test runner --------------------------------------------------------

async function main() {
  console.log(`\n=== Load test: ${TOTAL_CHAPTERS} chapters in ${CHUNK_SIZE}-row chunks ===\n`);
  console.log(`  Server: ${BASE}`);
  console.log(`  Account: ${EMAIL}\n`);

  // 1. Register
  console.log("1. Register / login");
  let r = await request("/register", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  // 200 or "Account already exists"
  assert(r.status === 200 || r.text.includes("already exists"), `register: ${r.status}`);

  r = await request("/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  assert(r.status === 200, `login: ${r.status}`);
  assert(cookie !== null, "cookie set");

  // 2. Fixtures
  console.log("\n2. Generating fixtures");
  const mangaCount = 1000;
  const categories = makeCategories();
  const allManga   = makeManga(mangaCount);
  const allTracks  = makeTracks(mangaCount);
  const allChapters = makeChapters(mangaCount, TOTAL_CHAPTERS);
  console.log(`   ${categories.length} categories, ${allManga.length} manga, ${allTracks.length} tracks, ${allChapters.length} chapters`);

  // 3. Chunked POST
  console.log("\n3. Chunked POST /sync/manga");
  const chunks = Math.ceil(TOTAL_CHAPTERS / CHUNK_SIZE);
  let afterChapters = null;
  let afterTracks   = null;
  let afterManga    = null;
  let afterCats     = null;

  for (let chunk = 0; chunk < chunks; chunk++) {
    const start = chunk * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, TOTAL_CHAPTERS);
    const chapterSlice = allChapters.slice(start, end);
    const isResetAll = chunk === 0;

    const body = {
      categories: isResetAll ? categories : [],
      deleted_categories: [],
      manga: isResetAll ? allManga : [],
      deleted_manga: [],
      chapters: chapterSlice,
      deleted_chapters: [],
      tracks: isResetAll ? allTracks : [],
      deleted_tracks: [],
      resetAll: isResetAll,
    };
    if (afterChapters != null) body.after_chapters = afterChapters;
    if (afterTracks   != null) body.after_tracks   = afterTracks;
    if (afterManga    != null) body.after_manga    = afterManga;
    if (afterCats     != null) body.after_categories = afterCats;

    const bodyBytes = JSON.stringify(body).length;
    console.log(`   Chunk ${chunk + 1}/${chunks}: chapters ${start + 1}–${end} (${bodyBytes} bytes)`);

    r = await request("/sync/manga", { method: "POST", body });
    assert(r.status === 200, `chunk ${chunk + 1} status: ${r.status}`);

    if (r.json) {
      const nc = r.json.nextCursor;
      const total = r.json.total;
      const totalChapters = total?.chapters ?? 0;

      // total should equal chapters sent so far (cumulative)
      const expectedTotal = end; // end = start + slice.length
      assert(totalChapters === expectedTotal, `chunk ${chunk + 1} total.chapters = ${totalChapters} (expected ${expectedTotal})`);

      // nextCursor.chapters should be non-null only when total > 50K cap
      const CAP = 50_000;
      if (totalChapters > CAP) {
        assert(nc && nc.chapters != null, `chunk ${chunk + 1} nextCursor.chapters non-null (total ${totalChapters} > ${CAP})`);
        afterChapters = nc?.chapters ?? null;
      } else {
        assert(nc?.chapters === null, `chunk ${chunk + 1} nextCursor.chapters null (total ${totalChapters} <= ${CAP})`);
        afterChapters = null;
      }
    }
  }

  // 4. Verify via GET
  console.log("\n4. Verification via GET");

  r = await request("/stats");
  assert(r.status === 200, `GET /stats: ${r.status}`);
  if (r.json) {
    assert(r.json.manga === mangaCount, `stats.manga = ${r.json.manga} (expected ${mangaCount})`);
    assert(r.json.chapters === TOTAL_CHAPTERS, `stats.chapters = ${r.json.chapters} (expected ${TOTAL_CHAPTERS})`);
    assert(r.json.categories === categories.length, `stats.categories = ${r.json.categories} (expected ${categories.length})`);
  }

  // GET /sync/chapters with mangaId filter (browse path)
  r = await request("/sync/chapters?mangaId=1&limit=500&sort=dateUpload&dir=desc");
  assert(r.status === 200, `GET /sync/chapters?mangaId=1: ${r.status}`);
  if (r.json) {
    const items = r.json.items || r.json.chapters || [];
    assert(items.length > 0, `chapters for manga 1: ${items.length} items`);
    assert(typeof r.json.total === "number" && r.json.total > 0, `total present: ${r.json.total}`);
  }

  // GET /sync/manga
  r = await request("/sync/manga?limit=100");
  assert(r.status === 200, `GET /sync/manga: ${r.status}`);
  if (r.json) {
    const items = r.json.items || r.json.manga || [];
    assert(items.length > 0, `manga items: ${items.length}`);
  }

  // GET /sync/tracks
  r = await request("/sync/tracks?limit=100");
  assert(r.status === 200, `GET /sync/tracks: ${r.status}`);
  if (r.json) {
    const items = r.json.items || r.json.tracks || [];
    assert(items.length > 0, `tracks items: ${items.length}`);
  }

  // 5. Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
