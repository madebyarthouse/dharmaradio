import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "~/lib/auth-client";

export type TalkId = number;
export type LibraryUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};
export type TalkProgress = {
  positionSec: number;
  durationSec: number | null;
  completed: boolean;
  updatedAt: string;
};
export type PlaylistSummary = {
  id: string;
  name: string;
  talkCount: number;
  totalDurationSec: number;
  updatedAt: string;
};
export type LibraryTalk = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  duration: number;
  publicationDate: string;
  audioUrl: string;
  teacher: {
    name: string;
    slug: string;
    profileImageUrl: string | null;
  } | null;
  center: { name: string; slug: string } | null;
  retreat: { title: string; slug: string } | null;
  savedAt?: string;
  likedAt?: string;
  progress?: TalkProgress;
  position?: number;
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
  toggleSaved(id: TalkId): Promise<void>;
  toggleLiked(id: TalkId): Promise<void>;
  reportProgress(id: TalkId, p: Omit<TalkProgress, "updatedAt">): void;
  createPlaylist(name: string, talkIds?: TalkId[]): Promise<PlaylistSummary>;
  renamePlaylist(id: string, name: string): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  addToPlaylist(playlistId: string, talkId: TalkId): Promise<void>;
  removeFromPlaylist(playlistId: string, talkId: TalkId): Promise<void>;
  reorderPlaylist(playlistId: string, talkIds: TalkId[]): Promise<void>;
  signInRequested: boolean;
  requestSignIn(): void;
  dismissSignIn(): void;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
};
type ProgressItem = TalkProgress & { talkId: number };
type Snapshot = {
  user: LibraryUser | null;
  savedIds: number[];
  likedIds: number[];
  progress: ProgressItem[];
  playlists: PlaylistSummary[];
};
const LibraryContext = createContext<LibraryContextValue | null>(null);
const LOCAL_KEY = "dharmaradio:anonymous-progress:v1";
function localProgress(): Map<number, TalkProgress> {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    if (!Array.isArray(items)) return new Map();
    return new Map(
      items
        .filter(
          (i): i is ProgressItem =>
            i &&
            Number.isSafeInteger(i.talkId) &&
            i.talkId > 0 &&
            Number.isFinite(i.positionSec) &&
            i.positionSec >= 0 &&
            (i.durationSec === null ||
              (Number.isFinite(i.durationSec) && i.durationSec >= 0)) &&
            typeof i.completed === "boolean" &&
            typeof i.updatedAt === "string" &&
            Number.isFinite(Date.parse(i.updatedAt)),
        )
        .map(({ talkId, ...p }) => [talkId, p]),
    );
  } catch {
    return new Map();
  }
}
function persistProgress(value: Map<number, TalkProgress>) {
  try {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify([...value].map(([talkId, p]) => ({ talkId, ...p }))),
    );
  } catch {
    /* Storage can be disabled or full. */
  }
}
async function api<T = { ok: boolean }>(
  path: string,
  method = "GET",
  body?: unknown,
  keepalive = false,
): Promise<T> {
  const response = await fetch(`/api/me${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    keepalive,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Sign in to use your library"
        : "Unable to update your library",
    );
  return response.json();
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] =
    useState<LibraryContextValue["status"]>("loading");
  const [user, setUser] = useState<LibraryUser | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(() => new Set());
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set());
  const [progress, setProgress] = useState<Map<number, TalkProgress>>(
    () => new Map(),
  );
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [signInRequested, setSignInRequested] = useState(false);
  const userRef = useRef<LibraryUser | null>(null);
  const pending = useRef(new Map<number, TalkProgress>());
  const toggling = useRef(
    new Map<string, { enabled: boolean; owner: string }>(),
  );
  const refreshVersion = useRef(0);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sessionId = session?.user.id;

  const flushProgress = useCallback(async (keepalive = false) => {
    if (!userRef.current || !pending.current.size) return;
    const owner = userRef.current.id;
    const items = [...pending.current]
      .slice(0, 100)
      .map(([talkId, p]) => ({ talkId, ...p }));
    try {
      await api("/progress/bulk", "POST", { items }, keepalive);
      if (userRef.current?.id === owner)
        for (const item of items) {
          if (pending.current.get(item.talkId)?.updatedAt === item.updatedAt)
            pending.current.delete(item.talkId);
        }
    } catch {
      /* Keep pending progress for the next flush. */
    }
  }, []);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      let snapshot = await api<Snapshot>("");
      if (version !== refreshVersion.current) return;
      const local = localProgress();
      if (snapshot.user && local.size) {
        for (let start = 0; start < local.size; start += 100) {
          const items = [...local]
            .slice(start, start + 100)
            .map(([talkId, p]) => ({ talkId, ...p }));
          await api("/progress/bulk", "POST", { items });
        }
        const remaining = localProgress();
        for (const [id, p] of local)
          if (remaining.get(id)?.updatedAt === p.updatedAt)
            remaining.delete(id);
        persistProgress(remaining);
        snapshot = await api<Snapshot>("");
      }
      if (version !== refreshVersion.current) return;
      if (userRef.current?.id !== snapshot.user?.id) pending.current.clear();
      userRef.current = snapshot.user;
      setUser(snapshot.user);
      const saved = new Set(snapshot.savedIds);
      const liked = new Set(snapshot.likedIds);
      // A focus/session refresh must preserve mutations still in flight.
      for (const [key, { enabled, owner }] of toggling.current) {
        if (owner !== snapshot.user?.id) continue;
        const [kind, id] = key.split(":");
        const ids = kind === "saved" ? saved : liked;
        if (enabled) ids.add(Number(id));
        else ids.delete(Number(id));
      }
      setSavedIds(saved);
      setLikedIds(liked);
      const next = snapshot.user
        ? new Map(snapshot.progress.map(({ talkId, ...p }) => [talkId, p]))
        : localProgress();
      for (const [id, p] of pending.current)
        if (!next.get(id) || p.updatedAt > next.get(id)!.updatedAt)
          next.set(id, p);
      setProgress(next);
      setPlaylists(snapshot.playlists);
      setStatus(snapshot.user ? "ready" : "anonymous");
      if (snapshot.user) setSignInRequested(false);
    } catch {
      if (version === refreshVersion.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!sessionPending) void refresh();
  }, [refresh, sessionId, sessionPending]);
  useEffect(() => {
    // Initial fetch is client-only, independent of Better Auth session polling.
    void refresh();
    const interval = window.setInterval(() => {
      void flushProgress();
    }, 15_000);
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const onFocus = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        void refresh();
      }, 300);
    };
    const onHide = () => {
      // Player listeners may run after this provider's listener. Defer until all
      // synchronous pagehide/visibility handlers have reported the last position.
      queueMicrotask(() => {
        void flushProgress(true);
      });
    };
    const onFlush = () => {
      queueMicrotask(() => {
        void flushProgress();
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("dharmaradio:flush-progress", onFlush);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      clearTimeout(focusTimer);
      window.removeEventListener("dharmaradio:flush-progress", onFlush);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushProgress, refresh]);

  const requestSignIn = useCallback(() => setSignInRequested(true), []);
  const toggle = async (kind: "saved" | "liked", id: number) => {
    if (!userRef.current) {
      requestSignIn();
      return;
    }
    const key = `${kind}:${id}`;
    if (toggling.current.has(key)) return;
    // Discard any older snapshot that was fetched before this mutation.
    ++refreshVersion.current;
    const owner = userRef.current.id;
    const current = kind === "saved" ? savedIds : likedIds;
    const setter = kind === "saved" ? setSavedIds : setLikedIds;
    const was = current.has(id);
    toggling.current.set(key, { enabled: !was, owner });
    setter((previous) => {
      const next = new Set(previous);
      if (was) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await api(`/${kind}/${id}`, was ? "DELETE" : "PUT");
    } catch (error) {
      if (userRef.current?.id === owner)
        setter((previous) => {
          const next = new Set(previous);
          if (was) next.add(id);
          else next.delete(id);
          return next;
        });
      throw error;
    } finally {
      ++refreshVersion.current;
      toggling.current.delete(key);
    }
  };
  const reportProgress = useCallback(
    (id: number, p: Omit<TalkProgress, "updatedAt">) => {
      if (!Number.isSafeInteger(id) || !Number.isFinite(p.positionSec)) return;
      const next = { ...p, updatedAt: new Date().toISOString() };
      setProgress((previous) => new Map(previous).set(id, next));
      if (!userRef.current) {
        const local = localProgress();
        local.set(id, next);
        persistProgress(local);
      } else {
        pending.current.set(id, next);
        if (p.completed) void flushProgress();
      }
    },
    [flushProgress],
  );
  const requireUser = () => {
    if (!userRef.current) {
      requestSignIn();
      throw new Error("Sign in to use playlists");
    }
  };
  const mutatePlaylist = async (
    path: string,
    method: string,
    body?: unknown,
  ) => {
    requireUser();
    await api(path, method, body);
    await refresh();
  };
  const value: LibraryContextValue = {
    status,
    user,
    savedIds,
    likedIds,
    progress,
    playlists,
    signInRequested,
    isSaved: (id) => savedIds.has(id),
    isLiked: (id) => likedIds.has(id),
    toggleSaved: (id) => toggle("saved", id),
    toggleLiked: (id) => toggle("liked", id),
    reportProgress,
    createPlaylist: async (name, talkIds) => {
      requireUser();
      const result = await api<PlaylistSummary>("/playlists", "POST", {
        name,
        talkIds,
      });
      await refresh();
      return result;
    },
    renamePlaylist: (id, name) =>
      mutatePlaylist(`/playlists/${encodeURIComponent(id)}`, "PATCH", { name }),
    deletePlaylist: (id) =>
      mutatePlaylist(`/playlists/${encodeURIComponent(id)}`, "DELETE"),
    addToPlaylist: (id, talkId) =>
      mutatePlaylist(`/playlists/${encodeURIComponent(id)}/items`, "POST", {
        talkId,
      }),
    removeFromPlaylist: (id, talkId) =>
      mutatePlaylist(
        `/playlists/${encodeURIComponent(id)}/items/${talkId}`,
        "DELETE",
      ),
    reorderPlaylist: (id, talkIds) =>
      mutatePlaylist(`/playlists/${encodeURIComponent(id)}/order`, "PUT", {
        talkIds,
      }),
    requestSignIn,
    dismissSignIn: () => setSignInRequested(false),
    refresh,
    signOut: async () => {
      await flushProgress();
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      await refresh();
    },
  };
  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary must be used inside LibraryProvider");
  return value;
}
