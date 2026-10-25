import { useEffect, useState } from "react";
import { useLibrary, type LibraryTalk } from "~/contexts/library-context";

export type LibraryView = "saved" | "liked" | "in-progress" | "history";

type State =
  | { status: "idle" | "loading" }
  | { status: "ready"; talks: LibraryTalk[]; page: number; totalPages: number; total: number }
  | { status: "error" };

/**
 * Client-only: library pages are cached shells, so their talks come from /api/me.
 * Refetches when the in-memory library changes (e.g. after unsaving a talk).
 */
export function useLibraryTalks(view: LibraryView, page = 1) {
  const library = useLibrary();
  const [state, setState] = useState<State>({ status: "idle" });
  const signedIn = Boolean(library.user);

  const revision =
    view === "saved"
      ? library.savedIds.size
      : view === "liked"
        ? library.likedIds.size
        : library.progress.size;

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    setState((current) => (current.status === "ready" ? current : { status: "loading" }));
    fetch(`/api/me/talks?view=${view}&page=${page}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{
          talks: LibraryTalk[];
          page: number;
          totalPages: number;
          total: number;
        }>;
      })
      .then((data) => setState({ status: "ready", ...data }))
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
  }, [view, page, signedIn, revision]);

  return state;
}
