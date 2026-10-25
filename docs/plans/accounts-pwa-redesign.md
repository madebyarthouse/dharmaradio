# Accounts, library, PWA & redesign — working contract

Branch: `refactor-q1-2026`. Search improvements are explicitly out of scope.

## Principles

- **All pages stay edge-cached and user-agnostic.** HTML never contains user data.
  User data is fetched client-side from `/api/me/*` (and `/api/auth/*`), which must
  always respond `Cache-Control: private, no-store` and never be written to the edge cache.
- Auth: better-auth with Google, Apple, and email (magic link / OTP) sent via
  Cloudflare Email Service (`send_email` binding). Secrets via `process.env`.
- Schema changes: edit `app/db/schema.ts` → `pnpm run db:generate`. Never handwrite migrations.
- `db:import:*` scripts must never copy user/auth tables between local and remote.

## File ownership (parallel agents share one checkout)

| Area | Owner | Files |
|---|---|---|
| Auth + library backend + client store | Sol "backend" | `app/lib/auth.server.ts`, `app/lib/auth-client.ts`, `app/lib/email.server.ts`, `app/lib/library.server.ts`, `app/routes/api.auth.$.ts`, `app/routes/api.me.*.ts`, `app/contexts/library-context.tsx`, `app/db/schema.ts`, migrations, `workers/app.ts`, `scripts/db-import-*`, `wrangler.jsonc`, `.dev.vars.example` |
| PWA + player engine | Sol "pwa" | `app/contexts/audio-context.tsx`, service worker files, `app/routes/[site.webmanifest].ts`, `public/site.webmanifest`, `app/entry.client.tsx`, `vite.config.ts` (if needed) |
| Design system, all UI, routes' JSX, auth/library pages | Claude (orchestrator) | `app/components/**`, `app/routes/*.tsx` (UI), `app/tailwind.css`, `app/root.tsx` layout |

`app/root.tsx`: backend may wrap the tree in `<LibraryProvider>`; pwa may add head tags. Keep edits minimal.
`app/routes.ts`: anyone may add routes; add lines, don't reorder.

## Library client contract — `app/contexts/library-context.tsx`

```ts
export type TalkId = number; // talks.id

export type LibraryUser = { id: string; name: string | null; email: string; image: string | null };

export type TalkProgress = {
  positionSec: number;
  durationSec: number | null;
  completed: boolean;
  updatedAt: string; // ISO
};

export type PlaylistSummary = {
  id: string;
  name: string;
  talkCount: number;
  totalDurationSec: number;
  updatedAt: string;
};

export type LibraryContextValue = {
  status: "loading" | "anonymous" | "ready" | "error";
  user: LibraryUser | null;

  savedIds: ReadonlySet<TalkId>;
  likedIds: ReadonlySet<TalkId>;
  progress: ReadonlyMap<TalkId, TalkProgress>;
  playlists: PlaylistSummary[];

  isSaved(id: TalkId): boolean;
  isLiked(id: TalkId): boolean;
  /** Optimistic. When anonymous: does nothing and calls requestSignIn(). */
  toggleSaved(id: TalkId): Promise<void>;
  toggleLiked(id: TalkId): Promise<void>;

  /** Throttled (~15s, plus on pause/ended/pagehide). Works anonymously via
   *  localStorage; local progress is merged to the server after sign-in. */
  reportProgress(id: TalkId, p: Omit<TalkProgress, "updatedAt">): void;

  createPlaylist(name: string, talkIds?: TalkId[]): Promise<PlaylistSummary>;
  renamePlaylist(id: string, name: string): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  addToPlaylist(playlistId: string, talkId: TalkId): Promise<void>;
  removeFromPlaylist(playlistId: string, talkId: TalkId): Promise<void>;
  reorderPlaylist(playlistId: string, talkIds: TalkId[]): Promise<void>;

  /** Sign-in UI is owned by the UI layer; this just flips state the UI reads. */
  signInRequested: boolean;
  requestSignIn(): void;
  dismissSignIn(): void;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
};

export function useLibrary(): LibraryContextValue;
```

## HTTP API (all JSON, all `private, no-store`, 401 when signed out except `GET /api/me`)

- `GET /api/me` → `{ user: LibraryUser | null, savedIds: number[], likedIds: number[], progress: Array<{talkId} & TalkProgress>, playlists: PlaylistSummary[] }`
- `PUT|DELETE /api/me/saved/:talkId`, `PUT|DELETE /api/me/liked/:talkId`
- `PUT /api/me/progress/:talkId` body `{positionSec, durationSec, completed}`; `POST /api/me/progress/bulk` body `{items: Array<{talkId} & TalkProgress>}` (merge, newest `updatedAt` wins)
- `GET /api/me/talks?view=saved|liked|in-progress|history&page=1` → `{ talks: LibraryTalk[], page, totalPages, total }`
- `POST /api/me/playlists` `{name, talkIds?}`; `GET|PATCH|DELETE /api/me/playlists/:id`; `POST /api/me/playlists/:id/items` `{talkId}`; `DELETE /api/me/playlists/:id/items/:talkId`; `PUT /api/me/playlists/:id/order` `{talkIds}`
- `GET /api/me/playlists/:id` → `{ playlist: PlaylistSummary, talks: LibraryTalk[] }`

```ts
export type LibraryTalk = {
  id: number; slug: string; title: string; description: string | null;
  duration: number; publicationDate: string; audioUrl: string;
  teacher: { name: string; slug: string; profileImageUrl: string | null } | null;
  center: { name: string; slug: string } | null;
  retreat: { title: string; slug: string } | null;
  // view-specific
  savedAt?: string; likedAt?: string; progress?: TalkProgress; position?: number;
};
```

## Player engine contract — `app/contexts/audio-context.tsx` (pwa owner)

Keep existing fields; `PlayerTalk.id` becomes `number` (talks.id). Add:

```ts
playbackRate: number; setPlaybackRate(r: number): void;   // persisted
seekBy(deltaSec: number): void;                            // ±15/30s
queue: PlayerTalk[];                                       // upcoming, user-editable
playNow(talk: PlayerTalk, context?: PlayerTalk[]): void;   // context = list it was started from
addToQueue(talk: PlayerTalk): void; playNextInQueue(talk: PlayerTalk): void;
removeFromQueue(id: number): void; clearQueue(): void;
sleepTimer: { endsAt: number } | { endOfTalk: true } | null;
setSleepTimer(v: { minutes: number } | { endOfTalk: true } | null): void;
isBuffering: boolean;
```

Behaviour: auto-advance on `ended`; restore last talk + position (paused) on reload from
localStorage; resume from `useLibrary().progress` when starting a talk with saved progress
(not completed); call `reportProgress`; Media Session metadata + action handlers
(play/pause/seekbackward/seekforward/previoustrack/nexttrack/seekto) and position state.
`LibraryProvider` wraps `AudioProvider`.

## PWA

Installable manifest (single source), maskable icons, offline app shell + offline fallback
page, runtime caching for HTML/assets that never caches `/api/*`, update prompt hook
(`usePwaUpdate()` exported for UI), install prompt hook (`useInstallPrompt()`), iOS meta tags.
Offline audio downloads only if dharmaseed audio is CORS/Range-friendly — investigate and report.
