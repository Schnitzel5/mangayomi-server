import type { PageId } from "./types";

type CellFormat = "id" | "string" | "datetime" | "relative" | "bool" | "readState" | "raw" | "itemType" | "status" | "seconds";

interface ColumnDef {
    header: string;
    key: string;
    format?: CellFormat;
    mono?: boolean;
}

interface FilterOption {
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    width?: string | undefined;
}

interface EntityConfig {
    pageId: PageId;
    endpoint: string;
    title: string;
    description: string;
    searchKeys: string[];
    columns: ColumnDef[];
    primaryField: string;
    emptyMessage: string;
    picksManga?: boolean;
    filters?: FilterOption[];
    defaultSort?: { field: string; dir: "asc" | "desc" };
}

const ENTITY_PAGES: Record<string, EntityConfig> = {
    library: {
        pageId: "library",
        endpoint: "/sync/manga",
        title: "Library",
        description: "Browse the manga you have synced from your Mangayomi client.",
        searchKeys: ["name", "title", "source", "author", "artist", "lang", "id"],
        primaryField: "name",
        emptyMessage: "Your library is empty. Sync your manga from the Flutter client to see them here.",
        columns: [
            { header: "#", key: "id", format: "id" },
            { header: "Title", key: "name", format: "string" },
            { header: "Source", key: "source", format: "string" },
            { header: "Type", key: "itemType", format: "itemType" },
            { header: "Lang", key: "lang", format: "string", mono: true },
            { header: "Status", key: "status", format: "status" },
            { header: "★", key: "favorite", format: "bool" },
            { header: "Last update", key: "lastUpdate", format: "relative" },
            { header: "Added", key: "dateAdded", format: "relative" },
            { header: "Synced", key: "updatedAt", format: "relative" },
        ],
    },
    history: {
        pageId: "history",
        endpoint: "/sync/histories",
        title: "History",
        description: "Recent chapter reads synced from the Mangayomi client.",
        searchKeys: ["mangaName", "chapterName", "mangaId", "chapterId", "id"],
        primaryField: "mangaName",
        emptyMessage: "No reading history yet. Open a chapter in the Flutter client to start your history.",
        columns: [
            { header: "#", key: "id", format: "id" },
            { header: "Manga", key: "mangaName", format: "string" },
            { header: "Chapter", key: "chapterName", format: "string" },
            { header: "Type", key: "itemType", format: "itemType" },
            { header: "Last read", key: "date", format: "datetime" },
            { header: "Time", key: "readingTimeSeconds", format: "seconds" },
        ],
    },
    updates: {
        pageId: "updates",
        endpoint: "/sync/updates",
        title: "Updates",
        description: "Chapters that have new releases tracked by your Mangayomi client.",
        searchKeys: ["mangaName", "chapterName", "mangaId", "id"],
        primaryField: "chapterName",
        emptyMessage: "No updates have been synced yet.",
        columns: [
            { header: "#", key: "id", format: "id" },
            { header: "Manga", key: "mangaName", format: "string" },
            { header: "Chapter", key: "chapterName", format: "string" },
            { header: "Released", key: "date", format: "datetime" },
            { header: "Synced", key: "updatedAt", format: "relative" },
        ],
    },
    tracking: {
        pageId: "tracking",
        endpoint: "/sync/tracks",
        title: "Tracking",
        description: "External tracker entries (AniList, MyAnimeList, etc.) synced from your client.",
        searchKeys: ["tracker", "title", "mangaName", "syncId", "mangaId", "id"],
        primaryField: "tracker",
        emptyMessage: "No tracking entries yet. Link a tracker in the Flutter client to see entries here.",
        columns: [
            { header: "#", key: "id", format: "id" },
            { header: "Tracker", key: "tracker", format: "string" },
            { header: "Title", key: "title", format: "string" },
            { header: "Manga", key: "mangaName", format: "string" },
            { header: "Score", key: "score", format: "raw" },
            { header: "Status", key: "status", format: "raw" },
            { header: "Last ch.", key: "lastChapterRead", format: "id" },
            { header: "URL", key: "trackingUrl", format: "string", mono: true },
            { header: "Synced", key: "updatedAt", format: "relative" },
        ],
    },
    categories: {
        pageId: "categories",
        endpoint: "/sync/categories",
        title: "Categories",
        description: "Categories that organise your library in the Mangayomi client.",
        searchKeys: ["name", "id"],
        primaryField: "name",
        emptyMessage: "No categories synced yet.",
        columns: [
            { header: "#", key: "id", format: "id" },
            { header: "Name", key: "name", format: "string" },
            { header: "Sort", key: "pos", format: "raw" },
            { header: "Type", key: "forItemType", format: "itemType" },
            { header: "Hidden", key: "hide", format: "bool" },
            { header: "Auto-update", key: "shouldUpdate", format: "bool" },
            { header: "Synced", key: "updatedAt", format: "relative" },
        ],
    },
    chapters: {
        pageId: "chapters",
        endpoint: "/sync/chapters",
        title: "Chapters",
        description: "Chapter records for the selected manga. Pick a manga from the list to start.",
        searchKeys: ["name", "mangaName", "scanlator", "mangaId", "id"],
        primaryField: "name",
        emptyMessage: "Pick a manga above to see its chapters.",
        picksManga: true,
        defaultSort: { field: "dateUpload", dir: "desc" },
        filters: [
            {
                key: "read",
                label: "Read",
                options: [
                    { value: "", label: "All" },
                    { value: "true", label: "Read" },
                    { value: "false", label: "Unread" },
                ],
            },
            {
                key: "bookmarked",
                label: "Bookmark",
                options: [
                    { value: "", label: "All" },
                    { value: "true", label: "Bookmarked" },
                    { value: "false", label: "Not bookmarked" },
                ],
            },
            {
                key: "sort",
                label: "Sort",
                options: [
                    { value: "dateUpload", label: "Date uploaded" },
                    { value: "name", label: "Name" },
                    { value: "lastPageRead", label: "Last page read" },
                    { value: "entity_id", label: "ID" },
                ],
                width: "10rem",
            },
            {
                key: "dir",
                label: "Order",
                options: [
                    { value: "desc", label: "Descending" },
                    { value: "asc", label: "Ascending" },
                ],
                width: "9rem",
            },
        ],
        columns: [
            { header: "#", key: "id", format: "id" },
            { header: "Manga", key: "mangaName", format: "string" },
            { header: "Name", key: "name", format: "string" },
            { header: "Bookmark", key: "isBookmarked", format: "bool" },
            { header: "Uploaded", key: "dateUpload", format: "datetime" },
            { header: "Scanlator", key: "scanlator", format: "string" },
            { header: "Page", key: "lastPageRead", format: "raw" },
            { header: "Synced", key: "updatedAt", format: "relative" },
        ],
    },
};

const PROTECTED_PAGES: ReadonlySet<PageId> = new Set<PageId>([
    "profile",
    "settings",
    "library",
    "history",
    "updates",
    "tracking",
    "categories",
    "chapters",
    "stats",
]);

interface ClientEntityConfig {
    pageId: PageId;
    endpoint: string;
    title: string;
    description: string;
    searchKeys: string[];
    primaryField: string;
    emptyMessage: string;
    columns: Array<{ header: string; key: string; format?: CellFormat | undefined; mono?: boolean | undefined }>;
    picksManga?: boolean | undefined;
    filters?: Array<{
        key: string;
        label: string;
        options: Array<{ value: string; label: string }>;
        width?: string | undefined;
    }> | undefined;
    defaultSort?: { field: string; dir: "asc" | "desc" } | undefined;
}

export function renderDashboardHtml(appName: string, initialPage: PageId, css: string): string {
    const safeName = escapeHtml(appName);
    const jsonName = JSON.stringify(appName);
    const initialJson = JSON.stringify(initialPage);
    const protectedJson = JSON.stringify(Array.from(PROTECTED_PAGES));
    const entityConfigsJson = JSON.stringify(serializeEntityConfigs());

    const navActive = (pageId: PageId) => (pageId === initialPage ? " btn-active" : "");
    const pageActive = (pageId: PageId) => (pageId === initialPage ? " is-active" : "");

    return `<!doctype html>
<html lang="en" data-theme="night">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeName}</title>
  <link rel="shortcut icon" type="image/png" href="https://raw.githubusercontent.com/kodjodevf/mangayomi/main/.github/readme_files/icon.png" />
  <style>${css}</style>
</head>
<body class="min-h-screen bg-base-100 text-base-content">
  <div class="manga-toast-stack" id="toast-stack" aria-live="polite"></div>

  <header class="navbar bg-base-200/80 backdrop-blur sticky top-0 z-30 border-b border-base-300/50">
    <div class="manga-shell flex items-center justify-between w-full !py-3">
      <div class="flex items-center gap-2">
        <a class="btn btn-ghost text-lg normal-case gap-2 px-2" href="/web/home" data-link>
          <img src="https://raw.githubusercontent.com/kodjodevf/mangayomi/main/.github/readme_files/icon.png" alt="Mangayomi" class="w-7 h-7" />
          <span class="font-bold">${safeName}</span>
        </a>
      </div>
      <div class="hidden md:flex items-center gap-0.5" id="nav-links">
        <a class="btn btn-ghost btn-sm${navActive("home")}" href="/web/home" data-link data-page="home">Home</a>
        <a class="btn btn-ghost btn-sm${navActive("library")}" href="/web/library" data-link data-page="library">Library</a>
        <a class="btn btn-ghost btn-sm${navActive("history")}" href="/web/history" data-link data-page="history">History</a>
        <a class="btn btn-ghost btn-sm${navActive("updates")}" href="/web/updates" data-link data-page="updates">Updates</a>
        <a class="btn btn-ghost btn-sm${navActive("tracking")}" href="/web/tracking" data-link data-page="tracking">Tracking</a>
        <a class="btn btn-ghost btn-sm${navActive("categories")}" href="/web/categories" data-link data-page="categories">Categories</a>
        <a class="btn btn-ghost btn-sm${navActive("chapters")}" href="/web/chapters" data-link data-page="chapters">Chapters</a>
        <a class="btn btn-ghost btn-sm${navActive("stats")}" href="/web/stats" data-link data-page="stats">Stats</a>
        <a class="btn btn-ghost btn-sm${navActive("settings")}" href="/web/settings" data-link data-page="settings">Settings</a>
      </div>
      <div class="flex items-center gap-2">
        <a class="btn btn-sm btn-ghost${navActive("profile")}" href="/web/profile" data-link data-page="profile" id="nav-profile">Profile</a>
        <a class="btn btn-sm btn-primary${navActive("login")}" href="/web/login" data-link data-page="login" id="nav-login">Login</a>
        <a class="btn btn-sm btn-ghost${navActive("register")}" href="/web/register" data-link data-page="register" id="nav-register">Register</a>
        <button class="btn btn-sm btn-ghost hidden" id="nav-logout" type="button">Logout</button>
        <button class="btn btn-sm btn-ghost md:hidden" id="burger" type="button" aria-label="Toggle menu" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>
    </div>
    <div class="md:hidden hidden w-full border-t border-base-300/50 bg-base-200" id="mobile-menu">
      <div class="manga-shell flex flex-col gap-1 py-3">
        <a class="btn btn-ghost btn-sm justify-start${navActive("home")}" href="/web/home" data-link data-page="home">Home</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("library")}" href="/web/library" data-link data-page="library">Library</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("history")}" href="/web/history" data-link data-page="history">History</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("updates")}" href="/web/updates" data-link data-page="updates">Updates</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("tracking")}" href="/web/tracking" data-link data-page="tracking">Tracking</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("categories")}" href="/web/categories" data-link data-page="categories">Categories</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("chapters")}" href="/web/chapters" data-link data-page="chapters">Chapters</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("stats")}" href="/web/stats" data-link data-page="stats">Stats</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("settings")}" href="/web/settings" data-link data-page="settings">Settings</a>
        <a class="btn btn-ghost btn-sm justify-start${navActive("profile")}" href="/web/profile" data-link data-page="profile">Profile</a>
      </div>
    </div>
  </header>

  <main class="manga-shell">
    <section id="page-home" class="manga-page${pageActive("home")}" data-page="home">
      <div class="manga-hero">
        <h1 class="text-4xl sm:text-5xl font-extrabold mb-3">${safeName}</h1>
        <p class="text-base-content/70 max-w-2xl mx-auto text-lg">
          Sync your manga, chapters, and reading progress across devices.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" id="home-stats-cards" style="display:none;">
        <div class="manga-stat">
          <div class="label">Manga</div>
          <div class="value" id="home-stat-manga">--</div>
        </div>
        <div class="manga-stat">
          <div class="label">Chapters</div>
          <div class="value" id="home-stat-chapters">--</div>
        </div>
        <div class="manga-stat">
          <div class="label">History</div>
          <div class="value" id="home-stat-history">--</div>
        </div>
      </div>

      <div class="manga-card">
        <h2>Get started</h2>
        <p class="mb-4">Connect your Mangayomi client to start syncing your library.</p>
        <div class="grid sm:grid-cols-2 gap-4">
          <div class="p-4 rounded-lg bg-base-300/30 border border-base-300/40">
            <h3 class="font-semibold mb-1">1. Register an account</h3>
            <p class="text-sm text-base-content/60">Create a free account to store your sync data.</p>
            <a class="btn btn-primary btn-sm mt-3" href="/web/register" data-link>Register</a>
          </div>
          <div class="p-4 rounded-lg bg-base-300/30 border border-base-300/40">
            <h3 class="font-semibold mb-1">2. Configure the client</h3>
            <p class="text-sm text-base-content/60">Enter this server URL in the Mangayomi app settings.</p>
            <code class="block mt-2 p-2 bg-base-300/50 rounded text-xs font-mono text-success break-all" id="home-server-url"></code>
          </div>
        </div>
      </div>

      <div class="manga-card mt-4">
        <h2>Features</h2>
        <ul class="grid sm:grid-cols-2 gap-3 mt-3">
          <li class="flex items-start gap-3 p-3 rounded-lg bg-base-300/20">
            <span class="text-primary mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
            </span>
            <div>
              <span class="font-medium">Library sync</span>
              <p class="text-sm text-base-content/60">Keep your manga list, chapters, and categories in sync.</p>
            </div>
          </li>
          <li class="flex items-start gap-3 p-3 rounded-lg bg-base-300/20">
            <span class="text-primary mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </span>
            <div>
              <span class="font-medium">Reading history</span>
              <p class="text-sm text-base-content/60">Track where you left off across all your devices.</p>
            </div>
          </li>
          <li class="flex items-start gap-3 p-3 rounded-lg bg-base-300/20">
            <span class="text-primary mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </span>
            <div>
              <span class="font-medium">Update tracking</span>
              <p class="text-sm text-base-content/60">Get notified when new chapters are released.</p>
            </div>
          </li>
          <li class="flex items-start gap-3 p-3 rounded-lg bg-base-300/20">
            <span class="text-primary mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </span>
            <div>
              <span class="font-medium">Tracker integration</span>
              <p class="text-sm text-base-content/60">Sync with AniList, MyAnimeList, and more.</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section id="page-register" class="manga-page${pageActive("register")}" data-page="register">
      <div class="manga-card max-w-xl mx-auto">
        <p class="manga-eyebrow">Create an account</p>
        <h2>Register</h2>
        <p>Create a free account to sync your manga library.</p>
        <form id="form-register" method="post" action="/register" autocomplete="off" class="grid gap-3">
          <label class="form-control">
            <span class="label-text mb-1">Email</span>
            <input class="input input-bordered" id="register-email" type="email" name="email" placeholder="you@example.com" required />
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Password</span>
            <input class="input input-bordered" id="register-password" type="password" name="password" minlength="8" placeholder="At least 8 characters" required />
          </label>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-primary" type="submit"><span>Register</span></button>
            <a class="btn btn-ghost" href="/web/login" data-link>Have an account? Log in</a>
          </div>
        </form>
        <div class="manga-status mt-3" id="register-status">Ready.</div>
      </div>
    </section>

    <section id="page-login" class="manga-page${pageActive("login")}" data-page="login">
      <div class="manga-card max-w-xl mx-auto">
        <p class="manga-eyebrow">Sign in</p>
        <h2>Login</h2>
        <p>Sign in to access your synced data.</p>
        <form id="form-login" method="post" action="/login" autocomplete="off" class="grid gap-3">
          <label class="form-control">
            <span class="label-text mb-1">Email</span>
            <input class="input input-bordered" id="login-email" type="email" name="email" placeholder="you@example.com" required />
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Password</span>
            <input class="input input-bordered" id="login-password" type="password" name="password" minlength="8" required />
          </label>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-primary" type="submit"><span>Login</span></button>
            <a class="btn btn-ghost" href="/web/register" data-link>Need an account? Register</a>
          </div>
        </form>
        <div class="manga-status mt-3" id="login-status">Ready.</div>
      </div>
    </section>

    <section id="page-profile" class="manga-page${pageActive("profile")}" data-page="profile">
      <div class="manga-card max-w-xl mx-auto">
        <p class="manga-eyebrow">Account</p>
        <h2>Profile</h2>
        <p id="profile-meta">Loading…</p>
        <form id="form-profile" method="post" action="/profile" autocomplete="off" class="grid gap-3">
          <label class="form-control">
            <span class="label-text mb-1">Email</span>
            <input class="input input-bordered" id="profile-email" type="email" name="email" required />
          </label>
          <label class="form-control">
            <span class="label-text mb-1">New password</span>
            <input class="input input-bordered" id="profile-password" type="password" name="password" minlength="8" required />
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Current password</span>
            <input class="input input-bordered" id="profile-password-old" type="password" name="passwordOld" minlength="8" required />
          </label>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-primary" type="submit"><span>Update profile</span></button>
            <button class="btn btn-error btn-outline" type="button" id="delete-account-btn">Delete account</button>
          </div>
        </form>
        <div class="manga-status mt-3" id="profile-status">Ready.</div>
      </div>
    </section>

    <section id="page-settings" class="manga-page${pageActive("settings")}" data-page="settings">
      <div class="manga-card">
        <p class="manga-eyebrow">Sync settings</p>
        <h2>Settings</h2>
        <p>Your synced settings from the Mangayomi client.</p>
        <div id="settings-grid" class="grid sm:grid-cols-2 gap-3 mt-3"></div>
        <div class="manga-status mt-3" id="settings-status">Loading…</div>
        <details class="mt-3">
          <summary class="cursor-pointer text-sm text-base-content/60 hover:text-base-content transition-colors">View raw JSON</summary>
          <pre id="settings-raw" class="bg-base-300/30 p-3 rounded-lg mt-2 text-xs overflow-x-auto"></pre>
        </details>
      </div>
    </section>

    <section id="page-library" class="manga-page${pageActive("library")}" data-page="library" data-entity="library"></section>
    <section id="page-history" class="manga-page${pageActive("history")}" data-page="history" data-entity="history"></section>
    <section id="page-updates" class="manga-page${pageActive("updates")}" data-page="updates" data-entity="updates"></section>
    <section id="page-tracking" class="manga-page${pageActive("tracking")}" data-page="tracking" data-entity="tracking"></section>
    <section id="page-categories" class="manga-page${pageActive("categories")}" data-page="categories" data-entity="categories"></section>
    <section id="page-chapters" class="manga-page${pageActive("chapters")}" data-page="chapters" data-entity="chapters"></section>

    <section id="page-stats" class="manga-page${pageActive("stats")}" data-page="stats">
      <div class="manga-card">
        <p class="manga-eyebrow">Sync statistics</p>
        <h2>Your data</h2>
        <p>Overview of your synced content.</p>
        <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3" id="stats-grid"></div>
        <div class="manga-status mt-3" id="stats-status">Loading…</div>
      </div>
    </section>
  </main>

  <footer class="manga-foot">
    <a href="https://github.com/Schnitzel5/mangayomi-server" target="_blank" rel="noopener">Mangayomi Sync Server</a>
  </footer>

  <dialog id="delete-modal" class="modal">
    <div class="modal-box bg-base-200 border border-base-300/60">
      <h3 class="font-bold text-lg">Delete account</h3>
      <p class="py-3 text-base-content/70">This permanently removes your account and all synced data. This cannot be undone.</p>
      <div class="modal-action">
        <form method="dialog" class="flex gap-2">
          <button class="btn btn-ghost">Cancel</button>
          <button class="btn btn-error" type="button" id="delete-account-confirm">Confirm delete</button>
        </form>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
  </dialog>

  <script>
    (function () {
      const APP_NAME = ${jsonName};
      const INITIAL_PAGE = ${initialJson};
      const PROTECTED_PAGES = new Set(${protectedJson});
      const TOKEN_KEY = "mangayomi-cloudflare-token";
      const ENTITY_CONFIGS = ${entityConfigsJson};

      const $ = (sel, root) => (root || document).querySelector(sel);
      const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

      function setStatus(el, message, kind) {
        if (!el) return;
        el.textContent = message;
        el.classList.remove("is-ok", "is-error", "is-loading");
        if (kind) el.classList.add("is-" + kind);
        if (!kind && message === "Loading…") {
          el.classList.add("is-loading");
        }
      }

      function showToast(message, kind) {
        const stack = $("#toast-stack");
        if (!stack) return;
        const node = document.createElement("div");
        node.className = "manga-toast" + (kind ? " is-" + kind : "");
        node.innerHTML = '<span>' + escapeHtml(String(message)) + '</span>';
        stack.appendChild(node);
        setTimeout(() => {
          node.style.transition = "opacity .3s, transform .3s";
          node.style.opacity = "0";
          node.style.transform = "translateY(8px)";
          setTimeout(() => node.remove(), 300);
        }, 4000);
      }

      function readToken() {
        try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
      }

      function writeToken(token) {
        try {
          if (token) localStorage.setItem(TOKEN_KEY, token);
          else localStorage.removeItem(TOKEN_KEY);
        } catch { /* ignore */ }
      }

      async function request(path, options) {
        options = options || {};
        const method = options.method || "GET";
        const auth = options.auth !== false;
        const headers = options.headers || {};
        if (options.body !== undefined) {
          headers["Content-Type"] = "application/json";
        }
        const token = readToken();
        if (auth && token) {
          headers["Authorization"] = "Bearer " + token;
        }
        const response = await fetch(path, {
          method,
          headers,
          credentials: "include",
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });
        const text = await response.text();
        const authToken = response.headers.get("X-Auth-Token");
        if (authToken) {
          writeToken(authToken);
        }
        return { response, text, authToken };
      }

      function pageIdFromPath(pathname) {
        const parts = pathname.replace(/^\\/+/, "").split("\\/").filter(Boolean);
        if (parts[0] === "web") {
          return parts[1] || "home";
        }
        return "home";
      }

      function pathFromPageId(pageId) {
        return "/web/" + pageId;
      }

      function setActiveNav(pageId) {
        $$('[data-link][data-page]').forEach((el) => {
          el.classList.toggle("btn-active", el.getAttribute("data-page") === pageId);
        });
      }

      function setAuthUi(signedIn) {
        const loginLink = $("#nav-login");
        const registerLink = $("#nav-register");
        const profileLink = $("#nav-profile");
        const logoutBtn = $("#nav-logout");
        if (signedIn) {
          if (loginLink) loginLink.classList.add("hidden");
          if (registerLink) registerLink.classList.add("hidden");
          if (profileLink) profileLink.classList.remove("hidden");
          if (logoutBtn) logoutBtn.classList.remove("hidden");
        } else {
          if (loginLink) loginLink.classList.remove("hidden");
          if (registerLink) registerLink.classList.remove("hidden");
          if (profileLink) profileLink.classList.add("hidden");
          if (logoutBtn) logoutBtn.classList.add("hidden");
        }
      }

      function showPage(pageId) {
        const target = $("#page-" + pageId) || $("#page-home");
        $$(".manga-page").forEach((el) => el.classList.remove("is-active"));
        target.classList.add("is-active");
        setActiveNav(pageId);
        setAuthUi(!!readToken());
        if (PROTECTED_PAGES.has(pageId)) {
          ensureSignedIn().then((signedIn) => {
            if (!signedIn) {
              navigateTo("login");
              return;
            }
            triggerLoader(pageId);
          });
        } else {
          triggerLoader(pageId);
        }
      }

      function triggerLoader(pageId) {
        if (pageId === "home") loadHomeStats();
        else if (pageId === "profile") loadProfile();
        else if (pageId === "stats") loadStats();
        else if (pageId === "settings") loadSettings();
        else if (ENTITY_CONFIGS[pageId]) loadEntityPage(ENTITY_CONFIGS[pageId]);
      }

      async function loadHomeStats() {
        const cards = $("#home-stats-cards");
        if (!cards) return;
        const token = readToken();
        if (!token) {
          cards.style.display = "none";
          return;
        }
        try {
          const result = await request("/stats", { auth: true });
          if (!result.response.ok) {
            cards.style.display = "none";
            return;
          }
          const data = JSON.parse(result.text);
          const mangaEl = $("#home-stat-manga");
          const chaptersEl = $("#home-stat-chapters");
          const historyEl = $("#home-stat-history");
          if (mangaEl) mangaEl.textContent = Number(data.manga || 0).toLocaleString();
          if (chaptersEl) chaptersEl.textContent = Number(data.chapters || 0).toLocaleString();
          if (historyEl) historyEl.textContent = Number(data.histories || 0).toLocaleString();
          cards.style.display = "";
        } catch {
          cards.style.display = "none";
        }
      }

      function navigateTo(pageId, replace) {
        const path = pathFromPageId(pageId);
        if (replace) history.replaceState({ pageId }, "", path);
        else history.pushState({ pageId }, "", path);
        showPage(pageId);
        closeMobileMenu();
      }

      function closeMobileMenu() {
        const menu = $("#mobile-menu");
        const burger = $("#burger");
        if (menu) menu.classList.add("hidden");
        if (burger) burger.setAttribute("aria-expanded", "false");
      }

      async function ensureSignedIn() {
        const token = readToken();
        if (!token) return false;
        try {
          const me = await request("/me", { auth: true });
          if (!me.response.ok) {
            writeToken(null);
            return false;
          }
          return true;
        } catch {
          return false;
        }
      }

      async function loadProfile() {
        const meta = $("#profile-meta");
        const emailInput = $("#profile-email");
        const status = $("#profile-status");
        setStatus(status, "Loading…");
        const me = await request("/me", { auth: true });
        if (!me.response.ok) {
          setStatus(status, me.text || ("HTTP " + me.response.status), "error");
          return;
        }
        let data;
        try { data = JSON.parse(me.text); } catch { data = {}; }
        meta.innerHTML = 'Signed in as <strong>' + escapeHtml(data.email || "") + '</strong>.';
        if (emailInput) emailInput.value = data.email || "";
        $("#profile-password").value = "";
        $("#profile-password-old").value = "";
        setStatus(status, "Ready.", "ok");
      }

      async function loadStats() {
        const grid = $("#stats-grid");
        const status = $("#stats-status");
        setStatus(status, "Loading…");
        const result = await request("/stats", { auth: true });
        if (!result.response.ok) {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          grid.innerHTML = "";
          return;
        }
        const data = JSON.parse(result.text);
        const stats = [
          { key: "manga", label: "Manga", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
          { key: "chapters", label: "Chapters", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
          { key: "histories", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
          { key: "updates", label: "Updates", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
          { key: "categories", label: "Categories", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
          { key: "tracks", label: "Tracks", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
        ];
        grid.innerHTML = stats.map((s) => {
          const value = Number(data[s.key] || 0);
          return '<div class="manga-stat flex items-center gap-3"><span class="text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="' + s.icon + '"></path></svg></span><div><div class="label">' + escapeHtml(s.label) + '</div><div class="value">' + value.toLocaleString() + '</div></div></div>';
        }).join("");
        setStatus(status, "Synced " + new Date().toLocaleTimeString(), "ok");
      }

      async function loadSettings() {
        const grid = $("#settings-grid");
        const status = $("#settings-status");
        const raw = $("#settings-raw");
        setStatus(status, "Loading…");
        const result = await request("/sync/settings", { auth: true });
        if (!result.response.ok) {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          grid.innerHTML = "";
          if (raw) raw.textContent = "";
          return;
        }
        let data;
        try {
          const body = JSON.parse(result.text);
          data = body.settings || body;
        } catch {
          data = {};
        }
        const entries = Object.keys(data).filter((k) => k !== "id" && k !== "updatedAt");
        if (entries.length === 0) {
          grid.innerHTML = '<div class="rounded-lg border border-dashed border-base-300 p-6 text-center"><p class="text-base-content/50">No settings stored yet.</p></div>';
        } else {
          grid.innerHTML = entries.map((key) => {
            const value = data[key];
            return (
              '<label class="form-control">' +
                '<span class="label-text mb-1">' + escapeHtml(key) + '</span>' +
                '<input class="input input-bordered" value="' + escapeHtml(formatValue(value)) + '" readonly />' +
              '</label>'
            );
          }).join("");
        }
        if (raw) raw.textContent = JSON.stringify(data, null, 2);
        setStatus(status, "Loaded " + entries.length + " fields at " + new Date().toLocaleTimeString(), "ok");
      }

      function formatValue(value) {
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      }

      async function loadEntityPage(config) {
        const page = $("#page-" + config.pageId);
        if (!page) return;
        if (!page.dataset.rendered) {
          let controlsHtml = '<div class="flex gap-2">' +
            '<input class="input input-bordered input-sm search-input" placeholder="Search…" />' +
            '<button class="btn btn-sm btn-ghost refresh-btn" type="button">Refresh</button>' +
          '</div>';
          let pickerHtml = "";
          let filtersHtml = "";
          if (config.picksManga) {
            pickerHtml =
              '<div class="mt-3 manga-picker grid sm:grid-cols-2 gap-2">' +
                '<label class="form-control">' +
                  '<span class="label-text mb-1">Search manga</span>' +
                  '<input class="input input-bordered input-sm manga-picker-search" placeholder="Type to filter by name or id…" disabled />' +
                '</label>' +
                '<label class="form-control">' +
                  '<span class="label-text mb-1">Manga</span>' +
                  '<select class="select select-bordered select-sm manga-select">' +
                    '<option value="">Pick a manga…</option>' +
                  '</select>' +
                '</label>' +
                '<span class="manga-picker-meta text-xs text-base-content/50 sm:col-span-2">Loading manga…</span>' +
              '</div>';
          }
          if (config.filters && config.filters.length > 0) {
            const fields = config.filters.map((f) => {
              const widthStyle = f.width ? ' style="width:' + f.width + '"' : "";
              const opts = f.options.map((o) =>
                '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</option>'
              ).join("");
              return '<label class="form-control">' +
                '<span class="label-text mb-1">' + escapeHtml(f.label) + '</span>' +
                '<select data-filter="' + escapeHtml(f.key) + '" class="select select-bordered select-sm"' + widthStyle + '>' + opts + '</select>' +
              '</label>';
            }).join("");
            filtersHtml = '<div class="mt-3 grid sm:grid-cols-2 md:grid-cols-4 gap-2 filter-bar">' + fields + '</div>';
          }
          page.innerHTML =
            '<div class="manga-card">' +
              '<div class="flex flex-wrap items-start justify-between gap-3">' +
                '<div>' +
                  '<p class="manga-eyebrow">' + escapeHtml(config.title) + '</p>' +
                  '<h2>' + escapeHtml(config.title) + '</h2>' +
                  '<p class="max-w-2xl text-base-content/60">' + escapeHtml(config.description) + '</p>' +
                '</div>' +
                controlsHtml +
              '</div>' +
              pickerHtml +
              filtersHtml +
              '<div class="manga-status mt-3 status-area">Loading…</div>' +
              '<div class="mt-3 table-wrap"></div>' +
            '</div>';
          page.dataset.rendered = "1";
          if (config.defaultSort) {
            const sortSel = page.querySelector('select[data-filter="sort"]');
            if (sortSel) sortSel.value = config.defaultSort.field;
            const dirSel = page.querySelector('select[data-filter="dir"]');
            if (dirSel) dirSel.value = config.defaultSort.dir;
          }
          const searchInput = page.querySelector(".search-input");
          if (searchInput) {
            searchInput.addEventListener("input", () => {
              page.dataset.search = searchInput.value || "";
              renderEntityRows(page, config);
            });
          }
          const refreshBtn = page.querySelector(".refresh-btn");
          if (refreshBtn) {
            refreshBtn.addEventListener("click", () => fetchAndRenderEntity(page, config));
          }
          page.querySelectorAll("select[data-filter]").forEach((sel) => {
            sel.addEventListener("change", () => {
              page.dataset[sel.dataset.filter] = sel.value;
              fetchAndRenderEntity(page, config);
            });
          });
          if (config.picksManga) {
            const select = page.querySelector(".manga-select");
            if (select) {
              select.addEventListener("change", () => {
                page.dataset.mangaId = select.value;
                fetchAndRenderEntity(page, config);
              });
            }
            populateMangaPicker(page, select);
          }
        }
        if (config.picksManga && !page.dataset.mangaId) {
          const status = page.querySelector(".status-area");
          setStatus(status, "Pick a manga to see its chapters.", "ok");
          return;
        }
        await fetchAndRenderEntity(page, config);
      }

      async function populateMangaPicker(page, select) {
        if (!select) return;
        const meta = page.querySelector(".manga-picker-meta");
        const allPages = [];
        let cursor = null;
        try {
          do {
            const url = "/sync/manga?limit=500" + (cursor ? "&after=" + cursor : "");
            const result = await request(url, { auth: true });
            if (!result.response.ok) {
              if (meta) meta.textContent = "Failed to load manga list.";
              return;
            }
            let body;
            try { body = JSON.parse(result.text); } catch { body = {}; }
            const items = Array.isArray(body.manga) ? body.manga : (Array.isArray(body.items) ? body.items : []);
            for (const m of items) {
              allPages.push(m);
            }
            cursor = body.nextCursor;
            if (meta) meta.textContent = "Loading manga… " + allPages.length.toLocaleString() + " of " + (body.total != null ? body.total.toLocaleString() : "?");
            if (!body.hasMore || !cursor) break;
          } while (cursor && allPages.length < 5000);
        } catch (err) {
          if (meta) meta.textContent = "Failed to load manga list.";
          return;
        }
        for (const m of allPages) {
          const id = String(m.id || "");
          if (!id) continue;
          const label = (m.name || "Manga " + id) + "  ·  #" + id;
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = label;
          opt.dataset.name = String(m.name || "").toLowerCase();
          opt.dataset.id = id;
          select.appendChild(opt);
        }
        if (page.dataset.mangaId) {
          select.value = page.dataset.mangaId;
        }
        if (meta) {
          const more = allPages.length >= 5000 ? " (first 5000 of " + (allPages.length + "+") + ")" : "";
          meta.textContent = allPages.length.toLocaleString() + " manga loaded" + more;
        }
        const search = page.querySelector(".manga-picker-search");
        if (search) {
          search.disabled = false;
          search.addEventListener("input", () => filterMangaPicker(select, search.value));
        }
      }

      function filterMangaPicker(select, query) {
        if (!select) return;
        const q = String(query || "").toLowerCase().trim();
        const options = Array.from(select.querySelectorAll("option")).slice(1);
        for (const opt of options) {
          if (!q) { opt.hidden = false; continue; }
          const name = opt.dataset.name || "";
          const id = opt.dataset.id || "";
          opt.hidden = !(name.includes(q) || id.includes(q));
        }
      }

      function buildEntityUrl(page, config) {
        const params = new URLSearchParams();
        params.set("limit", "500");
        if (page.dataset.mangaId) params.set("mangaId", page.dataset.mangaId);
        if (page.dataset.read) params.set("read", page.dataset.read);
        if (page.dataset.bookmarked) params.set("bookmarked", page.dataset.bookmarked);
        if (page.dataset.sort) params.set("sort", page.dataset.sort);
        if (page.dataset.dir) params.set("dir", page.dataset.dir);
        return config.endpoint + "?" + params.toString();
      }

      function buildMoreUrl(page, config) {
        const params = new URLSearchParams();
        params.set("limit", "500");
        const cursor = page.dataset.nextCursor;
        if (cursor) params.set("after", cursor);
        if (page.dataset.mangaId) params.set("mangaId", page.dataset.mangaId);
        if (page.dataset.read) params.set("read", page.dataset.read);
        if (page.dataset.bookmarked) params.set("bookmarked", page.dataset.bookmarked);
        if (page.dataset.sort) params.set("sort", page.dataset.sort);
        if (page.dataset.dir) params.set("dir", page.dataset.dir);
        return config.endpoint + "?" + params.toString();
      }

      async function fetchAndRenderEntity(page, config) {
        const status = page.querySelector(".status-area");
        if (config.picksManga && !page.dataset.mangaId) {
          setStatus(status, "Pick a manga to see its chapters.", "ok");
          const wrap = page.querySelector(".table-wrap");
          if (wrap) wrap.innerHTML = "";
          return;
        }
        setStatus(status, "Loading…");
        const url = buildEntityUrl(page, config);
        const result = await request(url, { auth: true });
        if (!result.response.ok) {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          const wrap = page.querySelector(".table-wrap");
          if (wrap) wrap.innerHTML = "";
          return;
        }
        let body;
        try { body = JSON.parse(result.text); } catch { body = {}; }
        const key = config.endpoint.split("/").pop();
        const items = Array.isArray(body[key]) ? body[key] : (Array.isArray(body.items) ? body.items : []);
        page.dataset.items = JSON.stringify(items);
        page.dataset.nextCursor = body.nextCursor != null ? String(body.nextCursor) : "";
        page.dataset.total = body.total != null ? String(body.total) : "";
        page.dataset.hasMore = body.hasMore ? "1" : "0";
        page.dataset.loading = "0";
        page.dataset.endpoint = config.endpoint;
        renderEntityRows(page, config);
        const total = Number(body.total || items.length);
        const more = body.hasMore ? " (showing " + items.length + " of " + total.toLocaleString() + ")" : "";
        setStatus(status, items.length + " item" + (items.length === 1 ? "" : "s") + more + " • " + new Date().toLocaleTimeString(), "ok");
      }

      async function loadMoreEntityRows(page, config) {
        if (page.dataset.loading === "1") return;
        if (page.dataset.hasMore !== "1") return;
        const cursor = page.dataset.nextCursor;
        if (!cursor) return;
        page.dataset.loading = "1";
        const sentinel = page.querySelector(".load-more-sentinel");
        if (sentinel) sentinel.textContent = "Loading more…";
        const url = buildMoreUrl(page, config);
        const result = await request(url, { auth: true });
        page.dataset.loading = "0";
        if (!result.response.ok) {
          if (sentinel) sentinel.textContent = "Failed to load more. Click to retry.";
          return;
        }
        let body;
        try { body = JSON.parse(result.text); } catch { body = {}; }
        const key = config.endpoint.split("/").pop();
        const newItems = Array.isArray(body[key]) ? body[key] : (Array.isArray(body.items) ? body.items : []);
        let items = [];
        try { items = JSON.parse(page.dataset.items || "[]"); } catch { items = []; }
        for (const item of newItems) {
          if (!items.some((existing) => String(existing.id) === String(item.id))) {
            items.push(item);
          }
        }
        page.dataset.items = JSON.stringify(items);
        page.dataset.nextCursor = body.nextCursor != null ? String(body.nextCursor) : "";
        page.dataset.hasMore = body.hasMore ? "1" : "0";
        page.dataset.total = body.total != null ? String(body.total) : page.dataset.total;
        renderEntityRows(page, config);
        const status = page.querySelector(".status-area");
        const total = Number(page.dataset.total || items.length);
        const more = page.dataset.hasMore === "1" ? " (showing " + items.length + " of " + total.toLocaleString() + ")" : "";
        if (status) setStatus(status, items.length + " item" + (items.length === 1 ? "" : "s") + more + " • " + new Date().toLocaleTimeString(), "ok");
      }

      function buildRowHtml(item, config) {
        const tds = config.columns.map((c) => {
          const v = formatCell(item[c.key], c.format, item);
          if (v === null) return "";
          const cls = c.mono ? ' class="font-mono text-xs text-base-content/60"' : "";
          return "<td" + cls + ">" + escapeHtml(v) + "</td>";
        }).join("");
        const primary = (() => {
          const p = item[config.primaryField];
          if (p === null || p === undefined) return String(item.id || "—");
          return String(p);
        })();
        const raw = JSON.stringify(item, null, 2);
        return (
          "<tr class='row-main cursor-pointer'>" + tds + "</tr>" +
          "<tr class='row-detail hidden'><td colspan='" + config.columns.length + "'>" +
            "<details><summary class='cursor-pointer text-sm text-base-content/50 hover:text-base-content transition-colors'>Raw JSON for " + escapeHtml(primary) + "</summary>" +
              "<pre class='bg-base-300/30 p-3 rounded-lg mt-2 text-xs overflow-x-auto'>" + escapeHtml(raw) + "</pre>" +
            "</details>" +
          "</td></tr>"
        );
      }

      function renderEntityRows(page, config) {
        const wrap = page.querySelector(".table-wrap");
        if (!wrap) return;
        let items = [];
        try { items = JSON.parse(page.dataset.items || "[]"); } catch { items = []; }
        const search = (page.dataset.search || "").toLowerCase().trim();
        if (search) {
          items = items.filter((item) => config.searchKeys.some((key) => {
            const value = item[key];
            return value !== undefined && value !== null && String(value).toLowerCase().includes(search);
          }));
        }
        if (items.length === 0) {
          wrap.innerHTML = '<div class="rounded-lg border border-dashed border-base-300 p-8 text-center"><p class="text-base-content/50">' + escapeHtml(config.emptyMessage) + '</p></div>';
          return;
        }
        const head = config.columns.map((c) => '<th>' + escapeHtml(c.header) + '</th>').join("");
        const headRow = "<thead><tr>" + head + "</tr></thead>";
        const body = items.map((item) => buildRowHtml(item, config)).join("");
        const sentinelHtml =
          '<tr class="load-more-row"><td colspan="' + config.columns.length + '">' +
            '<div class="flex justify-center py-3">' +
              '<button class="btn btn-sm btn-ghost load-more-sentinel" type="button">' +
                (page.dataset.hasMore === "1" ? "Load more" : "End of results") +
              '</button>' +
            '</div>' +
          '</td></tr>';
        wrap.innerHTML =
          '<div class="overflow-x-auto rounded-lg border border-base-300/50">' +
            '<table class="table table-sm manga-table">' +
              headRow + "<tbody>" + body + sentinelHtml + "</tbody>" +
            '</table>' +
          '</div>';
        wrap.querySelectorAll("tr.row-main").forEach((row, index) => {
          row.addEventListener("click", () => {
            const detail = wrap.querySelectorAll("tr.row-detail")[index];
            if (detail) detail.classList.toggle("hidden");
          });
        });
        const sentinel = wrap.querySelector(".load-more-sentinel");
        if (sentinel && page.dataset.hasMore === "1") {
          sentinel.addEventListener("click", () => loadMoreEntityRows(page, config));
          if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting && page.dataset.hasMore === "1" && page.dataset.loading !== "1") {
                  loadMoreEntityRows(page, config);
                }
              }
            }, { rootMargin: "200px" });
            observer.observe(sentinel);
          }
        }
      }

      function formatCell(value, format, row) {
        if (value === null || value === undefined) return "—";
        switch (format) {
          case "id":
            return String(value);
          case "bool":
            return value === true || value === "true" || value === 1 || value === "1" ? "✓" : "—";
          case "readState":
            return readStateLabel(value, row);
          case "datetime":
            return toAbsoluteTime(value);
          case "relative":
            return toAbsoluteTime(value);
          case "itemType":
            return itemTypeLabel(value);
          case "status":
            return mangaStatusLabel(value);
          case "seconds":
            return formatSeconds(value);
          case "raw":
            if (typeof value === "string") return value;
            if (typeof value === "number" || typeof value === "boolean") return String(value);
            try { return JSON.stringify(value); } catch { return "—"; }
          case "string":
          default:
            if (typeof value === "string") return value;
            if (typeof value === "number" || typeof value === "boolean") return String(value);
            try { return JSON.stringify(value); } catch { return "—"; }
        }
      }

      function readStateLabel(isReadValue, row) {
        const isRead = isReadValue === true || isReadValue === "true" || isReadValue === 1 || isReadValue === "1";
        if (isRead) return "✓";
        const lastPage = row && (row.lastPageRead != null) ? String(row.lastPageRead).trim() : "";
        if (lastPage && /^\\d+$/.test(lastPage) && Number(lastPage) > 0) {
          return "→" + lastPage;
        }
        return "—";
      }

      function itemTypeLabel(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        switch (n) {
          case 0: return "Manga";
          case 1: return "Anime";
          case 2: return "Novel";
          default: return "Type " + n;
        }
      }

      function mangaStatusLabel(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        switch (n) {
          case 0: return "Ongoing";
          case 1: return "Completed";
          case 2: return "Licensed";
          case 3: return "Finished";
          case 4: return "Cancelled";
          case 5: return "Hiatus";
          default: return "Status " + n;
        }
      }

      function formatSeconds(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return "—";
        const s = Math.round(n);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return h + "h " + m + "m";
        if (m > 0) return m + "m " + sec + "s";
        return sec + "s";
      }

      function toAbsoluteTime(value) {
        if (value === null || value === undefined) return "—";
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return String(value);
        try {
          const ms = n > 1e12 ? n : n * 1000;
          return new Date(ms).toLocaleString();
        } catch {
          return String(value);
        }
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      async function submitRegister(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        const status = $("#register-status");
        setStatus(status, "Submitting…");
        const result = await request("/register", {
          method: "POST",
          body: { email: String(fd.get("email") || ""), password: String(fd.get("password") || "") },
          auth: false,
        });
        if (result.response.ok) {
          setStatus(status, result.text || "Account registered!", "ok");
          showToast("Account registered. Logging you in…", "success");
          if (result.authToken) navigateTo("profile");
        } else {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          showToast(result.text || ("HTTP " + result.response.status), "error");
        }
      }

      async function submitLogin(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        const status = $("#login-status");
        setStatus(status, "Submitting…");
        const result = await request("/login", {
          method: "POST",
          body: { email: String(fd.get("email") || ""), password: String(fd.get("password") || "") },
          auth: false,
        });
        if (result.response.ok) {
          setStatus(status, result.text || "Welcome!", "ok");
          showToast("Logged in", "success");
          if (result.authToken) navigateTo("profile");
        } else {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          showToast(result.text || ("HTTP " + result.response.status), "error");
        }
      }

      async function submitProfile(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        const status = $("#profile-status");
        setStatus(status, "Submitting…");
        const result = await request("/profile", {
          method: "POST",
          body: {
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
            passwordOld: String(fd.get("passwordOld") || ""),
          },
          auth: true,
        });
        if (result.response.ok) {
          setStatus(status, result.text || "Account updated!", "ok");
          showToast("Account updated", "success");
          loadProfile();
        } else {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          showToast(result.text || ("HTTP " + result.response.status), "error");
        }
      }

      async function logout() {
        const status = $("#profile-status");
        setStatus(status, "Logging out…");
        const result = await request("/logout", { method: "GET", auth: true });
        writeToken(null);
        setStatus(status, result.text || "Logged out!", "ok");
        showToast("Logged out", "info");
        navigateTo("login");
      }

      function deleteAccount() {
        const modal = $("#delete-modal");
        if (modal && typeof modal.showModal === "function") {
          modal.showModal();
        } else if (confirm("Delete this account and all sync data? This cannot be undone.")) {
          performDelete();
        }
      }

      async function performDelete() {
        const status = $("#profile-status");
        setStatus(status, "Deleting…");
        const result = await request("/delete", { method: "DELETE", auth: true });
        writeToken(null);
        if (result.response.ok) {
          setStatus(status, result.text || "Account deleted.", "ok");
          showToast("Account deleted", "info");
          navigateTo("register");
        } else {
          setStatus(status, result.text || ("HTTP " + result.response.status), "error");
          showToast(result.text || ("HTTP " + result.response.status), "error");
        }
      }

      function wireBurger() {
        const burger = $("#burger");
        const menu = $("#mobile-menu");
        if (!burger || !menu) return;
        burger.addEventListener("click", () => {
          const expanded = burger.getAttribute("aria-expanded") === "true";
          burger.setAttribute("aria-expanded", expanded ? "false" : "true");
          menu.classList.toggle("hidden");
        });
      }

      function wireDelegatedLinks() {
        document.addEventListener("click", (event) => {
          const link = event.target.closest("a[data-link]");
          if (!link) return;
          const href = link.getAttribute("href");
          if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;
          event.preventDefault();
          const pageId = pageIdFromPath(href);
          navigateTo(pageId);
        });
        window.addEventListener("popstate", () => {
          showPage(pageIdFromPath(window.location.pathname));
        });
      }

      function wireForms() {
        const reg = $("#form-register");
        if (reg) reg.addEventListener("submit", submitRegister);
        const log = $("#form-login");
        if (log) log.addEventListener("submit", submitLogin);
        const prof = $("#form-profile");
        if (prof) prof.addEventListener("submit", submitProfile);
        const lo = $("#nav-logout");
        if (lo) lo.addEventListener("click", logout);
        const del = $("#delete-account-btn");
        if (del) del.addEventListener("click", deleteAccount);
        const delConfirm = $("#delete-account-confirm");
        if (delConfirm) {
          delConfirm.addEventListener("click", () => {
            const modal = $("#delete-modal");
            if (modal && typeof modal.close === "function") modal.close();
            performDelete();
          });
        }
      }

      function init() {
        wireDelegatedLinks();
        wireBurger();
        wireForms();
        const serverUrlEl = $("#home-server-url");
        if (serverUrlEl) serverUrlEl.textContent = window.location.origin;
        const pathPage = pageIdFromPath(window.location.pathname);
        if (pathPage !== INITIAL_PAGE) {
          history.replaceState({ pageId: pathPage }, "", window.location.pathname);
        }
        showPage(pathPage);
        ensureSignedIn().then((signedIn) => setAuthUi(signedIn));
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    })();
  </script>
</body>
</html>`;
}

function serializeEntityConfigs(): Record<string, ClientEntityConfig> {
    const out: Record<string, ClientEntityConfig> = {};
    for (const [key, config] of Object.entries(ENTITY_PAGES)) {
        out[key] = {
            pageId: config.pageId,
            endpoint: config.endpoint,
            title: config.title,
            description: config.description,
            searchKeys: config.searchKeys,
            primaryField: config.primaryField,
            emptyMessage: config.emptyMessage,
            columns: config.columns.map((c) => ({
                header: c.header,
                key: c.key,
                format: c.format,
                mono: c.mono,
            })),
            picksManga: config.picksManga === true ? true : undefined,
            filters: config.filters
                ? config.filters.map((f) => ({ key: f.key, label: f.label, options: f.options, width: f.width }))
                : undefined,
            defaultSort: config.defaultSort,
        };
    }
    return out;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
