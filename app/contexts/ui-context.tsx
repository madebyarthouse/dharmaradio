import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { TalkListItem } from "~/lib/talk";

type Toast = { id: number; message: string };

type UIContextValue = {
  toasts: Toast[];
  toast(message: string): void;
  playlistTarget: TalkListItem | null;
  openAddToPlaylist(talk: TalkListItem): void;
  closeAddToPlaylist(): void;
  nowPlayingOpen: boolean;
  setNowPlayingOpen(open: boolean): void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [playlistTarget, setPlaylistTarget] = useState<TalkListItem | null>(null);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const nextId = useRef(0);

  const toast = useCallback((message: string) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      toasts,
      toast,
      playlistTarget,
      openAddToPlaylist: setPlaylistTarget,
      closeAddToPlaylist: () => setPlaylistTarget(null),
      nowPlayingOpen,
      setNowPlayingOpen,
    }),
    [toasts, toast, playlistTarget, nowPlayingOpen],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const value = useContext(UIContext);
  if (!value) throw new Error("useUI must be used within UIProvider");
  return value;
}
