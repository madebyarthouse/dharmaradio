import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ListMusic, Plus, RefreshCw, X } from "lucide-react";
import { useLibrary } from "~/contexts/library-context";
import { useUI } from "~/contexts/ui-context";
import { usePwaUpdate } from "~/hooks/use-pwa-update";
import { AuthPanel } from "~/components/auth-panel";
import { BrandMark } from "~/components/brand";
import { Button } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

const panelClass = cn(
  "fixed z-50 bg-paper outline-none",
  "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-line px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 data-[state=open]:animate-[sheet-up_360ms_var(--ease-calm)]",
  "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:p-8 sm:shadow-soft sm:data-[state=open]:animate-pop",
);

function SheetHandle() {
  return <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong sm:hidden" />;
}

function CloseButton() {
  return (
    <Dialog.Close
      aria-label="Close"
      className="absolute right-4 top-4 hidden size-9 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink sm:inline-flex"
    >
      <X size={18} />
    </Dialog.Close>
  );
}

export function SignInDialog() {
  const library = useLibrary();
  const open = library.signInRequested && !library.user;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && library.dismissSignIn()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[fade_200ms]" />
        <Dialog.Content className={panelClass}>
          <SheetHandle />
          <CloseButton />
          <BrandMark size={36} />
          <Dialog.Title className="mt-4 font-serif text-2xl tracking-tight">
            Keep your practice in one place
          </Dialog.Title>
          <Dialog.Description className="mb-6 mt-2 text-sm text-ink-soft">
            Sign in to save talks, build playlists and pick up where you left off on any device.
          </Dialog.Description>
          <AuthPanel onDone={library.dismissSignIn} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AddToPlaylistDialog() {
  const ui = useUI();
  const library = useLibrary();
  const talk = ui.playlistTarget;
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const open = Boolean(talk);
  const close = () => {
    ui.closeAddToPlaylist();
    setCreating(false);
    setAdded(null);
  };

  const add = async (playlistId: string, name: string) => {
    if (!talk) return;
    await library.addToPlaylist(playlistId, talk.id);
    setAdded(playlistId);
    ui.toast(`Added to ${name}`);
    window.setTimeout(close, 450);
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!talk) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    await library.createPlaylist(name, [talk.id]);
    ui.toast(`Created ${name}`);
    close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[fade_200ms]" />
        <Dialog.Content className={panelClass}>
          <SheetHandle />
          <CloseButton />
          <Dialog.Title className="font-serif text-2xl tracking-tight">Add to playlist</Dialog.Title>
          <Dialog.Description className="mt-1 line-clamp-1 text-sm text-ink-soft">
            {talk?.title}
          </Dialog.Description>

          <ul className="-mx-2 mt-5 max-h-72 overflow-y-auto">
            {library.playlists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  onClick={() => void add(playlist.id, playlist.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-paper-sunken"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent-wash text-accent-ink">
                    {added === playlist.id ? <Check size={18} /> : <ListMusic size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{playlist.name}</span>
                    <span className="block text-xs text-ink-faint">
                      {playlist.talkCount} {playlist.talkCount === 1 ? "talk" : "talks"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {creating ? (
            <form onSubmit={create} className="mt-4 flex gap-2">
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Playlist name"
                aria-label="Playlist name"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-paper-raised px-4 outline-none focus:shadow-[0_0_0_4px_var(--accent-wash)]"
              />
              <Button type="submit">Create</Button>
            </form>
          ) : (
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setCreating(true)}>
              <Plus size={16} /> New playlist
            </Button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Toaster() {
  const { toasts } = useUI();
  const { updateAvailable, applyUpdate } = usePwaUpdate();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-24"
    >
      {updateAvailable ? (
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-sm text-paper shadow-soft animate-rise">
          A new version is ready
          <button
            type="button"
            onClick={() => applyUpdate()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-paper px-3 text-ink active:scale-95"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      ) : null}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-soft animate-rise"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
