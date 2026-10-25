import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLibrary } from "~/contexts/library-context";
import type { PracticeKind, PracticeSession } from "~/lib/practice";

type LogInput = {
  durationSec: number;
  kind: PracticeKind;
  talkId?: number | null;
  talkTitle?: string | null;
  startedAt?: number;
};
type PracticeValue = {
  status: "loading" | "ready";
  sessions: PracticeSession[];
  synced: boolean;
  log(input: LogInput): void;
  remove(id: string): void;
};
const PracticeContext = createContext<PracticeValue | null>(null);
const KEY = "dharmaradio:practice:v1";
const merge = (...lists: PracticeSession[][]) =>
  [...new Map(lists.flat().map((s) => [s.id, s])).values()].sort(
    (a, b) => b.startedAt - a.startedAt || b.id.localeCompare(a.id),
  );
function readLocal(): PracticeSession[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(data)
      ? merge(
          data.filter(
            (s): s is PracticeSession =>
              s &&
              typeof s.id === "string" &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                s.id,
              ) &&
              Number.isSafeInteger(s.startedAt) &&
              s.startedAt >= 0 &&
              s.startedAt <= Date.now() + 60000 &&
              Number.isInteger(s.durationSec) &&
              s.durationSec >= 60 &&
              s.durationSec <= 14400 &&
              ["timer", "guided"].includes(s.kind) &&
              (s.talkId === null ||
                (Number.isSafeInteger(s.talkId) && s.talkId > 0)) &&
              (s.talkTitle == null ||
                (typeof s.talkTitle === "string" &&
                  s.talkTitle.length <= 2000)),
          ),
        )
      : [];
  } catch {
    return [];
  }
}
function persist(sessions: PracticeSession[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    /* Private mode/storage quota. */
  }
}
async function api(path = "", method = "GET", body?: unknown) {
  const response = await fetch(`/api/me/practice${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(`Practice sync failed (${response.status})`);
  return response.json() as Promise<{ sessions: PracticeSession[] }>;
}
async function upload(sessions: PracticeSession[]) {
  for (let i = 0; i < sessions.length; i += 100)
    await api("", "POST", { sessions: sessions.slice(i, i + 100) });
}

export function PracticeProvider({ children }: { children: ReactNode }) {
  const { user, status: libraryStatus } = useLibrary();
  const userId = user?.id ?? null;
  const libraryLoading = libraryStatus === "loading";
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const state = useRef<PracticeSession[]>([]);
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const removed = useRef(new Set<string>());
  const replace = useCallback((next: PracticeSession[]) => {
    state.current = next;
    setSessions(next);
  }, []);
  const enqueue = useCallback((work: () => Promise<void>) => {
    const token = generation.current;
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        if (generation.current === token) await work();
      })
      .catch((error) => {
        console.warn("practice:sync", error);
      });
  }, []);

  useEffect(() => {
    if (libraryLoading) return;
    const token = ++generation.current;
    identity.current = userId;
    removed.current = new Set();
    replace(readLocal());
    setStatus(userId ? "loading" : "ready");
    if (!userId) return;
    const sync = () =>
      enqueue(async () => {
        try {
          const local = readLocal();
          await upload(local);
          if (generation.current !== token) return;
          const uploaded = new Set(local.map((s) => s.id));
          persist(readLocal().filter((s) => !uploaded.has(s.id)));
          const remote = await api();
          if (generation.current === token)
            replace(
              merge(remote.sessions, state.current).filter(
                (s) => !removed.current.has(s.id),
              ),
            );
        } finally {
          if (generation.current === token) setStatus("ready");
        }
      });
    sync();
    window.addEventListener("online", sync);
    return () => {
      // This is an async generation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      window.removeEventListener("online", sync);
    };
  }, [userId, libraryLoading, enqueue, replace]);

  const log = useCallback(
    (input: LogInput) => {
      if (
        !Number.isFinite(input.durationSec) ||
        input.durationSec < 60 ||
        input.durationSec > 14400 ||
        !["timer", "guided"].includes(input.kind)
      )
        return;
      const startedAt = input.startedAt ?? Date.now();
      if (
        !Number.isSafeInteger(startedAt) ||
        startedAt < 0 ||
        startedAt > Date.now() + 60000
      )
        return;
      const session: PracticeSession = {
        ...input,
        id: crypto.randomUUID(),
        startedAt,
        durationSec: Math.floor(input.durationSec),
        talkId: input.talkId ?? null,
      };
      replace(merge(state.current, [session]));
      if (!identity.current) {
        persist(state.current);
        return;
      }
      const token = generation.current;
      enqueue(async () => {
        try {
          await upload([session]);
        } catch (error) {
          if (generation.current === token)
            replace(state.current.filter((s) => s.id !== session.id));
          throw error;
        }
      });
    },
    [enqueue, replace],
  );
  const remove = useCallback(
    (id: string) => {
      const session = state.current.find((s) => s.id === id);
      if (!session) return;
      removed.current.add(id);
      replace(state.current.filter((s) => s.id !== id));
      if (!identity.current) {
        persist(state.current);
        return;
      }
      const token = generation.current;
      enqueue(async () => {
        try {
          await api(`/${encodeURIComponent(id)}`, "DELETE");
          if (generation.current === token)
            persist(readLocal().filter((s) => s.id !== id));
        } catch (error) {
          if (generation.current === token) {
            removed.current.delete(id);
            replace(merge(state.current, [session]));
          }
          throw error;
        }
      });
    },
    [enqueue, replace],
  );
  return (
    <PracticeContext.Provider
      value={{ status, sessions, synced: !!user, log, remove }}
    >
      {children}
    </PracticeContext.Provider>
  );
}
export function usePractice() {
  const context = useContext(PracticeContext);
  if (!context)
    throw new Error("usePractice must be used within a PracticeProvider");
  return context;
}
