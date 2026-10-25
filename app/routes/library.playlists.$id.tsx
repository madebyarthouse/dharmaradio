import type { MetaFunction } from "react-router";
import { Link, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowDown, ArrowUp, ListMusic, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useLibrary, type LibraryTalk, type PlaylistSummary } from "~/contexts/library-context";
import { useUI } from "~/contexts/ui-context";
import { toPlayerTalk } from "~/lib/talk";
import { formatCount, formatDuration } from "~/lib/format";
import { noindex, shellHeaders } from "~/lib/shell-route";
import { TalkRow, menuContentClass, menuItemClass } from "~/components/talk-row";
import { ListSkeleton, RequireAccount } from "~/components/library-ui";
import { Breadcrumbs, Button, EmptyState, MetaList, buttonClass, titleClass } from "~/components/ui/primitives";
import { PlayGlyph } from "~/components/play-glyph";
import { cn } from "~/lib/cn";

export const meta: MetaFunction = () => [{ title: "Playlist, Dharma Radio" }, noindex];
export const headers = shellHeaders;

type Data = { playlist: PlaylistSummary; talks: LibraryTalk[] };

export default function PlaylistPage() {
  return (
    <div className="animate-rise">
      <div className="pt-7 md:pt-12">
        <PlaylistCrumbs />
      </div>
      <RequireAccount>
        <Playlist />
      </RequireAccount>
    </div>
  );
}

/** Practice, then this playlist; its name is known on the client once the library loads. */
function PlaylistCrumbs() {
  const { id = "" } = useParams();
  const library = useLibrary();
  const name = library.playlists.find((p) => p.id === id)?.name ?? "Playlist";
  return (
    <Breadcrumbs
      structuredData={false}
      items={[
        { label: "Practice", to: "/practice" },
        { label: name, to: `/library/playlists/${id}` },
      ]}
    />
  );
}

function Playlist() {
  const { id = "" } = useParams();
  const library = useLibrary();
  const audio = useAudio();
  const ui = useUI();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/me/playlists/${encodeURIComponent(id)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      setFailed(true);
      return;
    }
    setData((await response.json()) as Data);
  }, [id]);

  // Re-sync when the summary in the library changes (items added from elsewhere).
  const summary = library.playlists.find((p) => p.id === id);
  useEffect(() => {
    void load();
  }, [load, summary?.talkCount, summary?.updatedAt]);

  if (failed) {
    return (
      <EmptyState title="Playlist not found" action={<Link to="/practice" className={buttonClass("primary")}>Back to your practice</Link>}>
        It may have been deleted on another device.
      </EmptyState>
    );
  }
  if (!data) return <ListSkeleton />;

  const { playlist, talks } = data;

  const playAll = () => {
    const [first] = talks;
    if (first) audio.playNow(toPlayerTalk(first), talks.map(toPlayerTalk));
  };

  const move = async (index: number, delta: -1 | 1) => {
    const next = [...talks];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(index + delta, 0, item);
    setData({ playlist, talks: next });
    await library.reorderPlaylist(playlist.id, next.map((t) => t.id)).catch(() => load());
  };

  const remove = async (talk: LibraryTalk) => {
    setData({ playlist, talks: talks.filter((t) => t.id !== talk.id) });
    await library.removeFromPlaylist(playlist.id, talk.id).catch(() => load());
  };

  const rename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    setRenaming(false);
    setData({ playlist: { ...playlist, name }, talks });
    await library.renamePlaylist(playlist.id, name);
  };

  const destroy = async () => {
    if (!window.confirm(`Delete “${playlist.name}”? The talks stay in the archive.`)) return;
    await library.deletePlaylist(playlist.id);
    ui.toast("Playlist deleted");
    navigate("/practice");
  };

  const total = talks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <>
      <header className="flex flex-col gap-6 pb-6 pt-4 md:flex-row md:items-end">
        <span className="flex size-32 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-accent-ink shadow-soft ring-1 ring-inset ring-line md:size-40">
          <ListMusic size={48} strokeWidth={1.25} />
        </span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form onSubmit={rename} className="mt-2 flex gap-2">
              <input
                name="name"
                defaultValue={playlist.name}
                maxLength={80}
                aria-label="Playlist name"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="h-14 min-w-0 flex-1 rounded-xl bg-paper-raised px-4 font-serif text-[1.75rem] outline-none ring-1 ring-inset ring-line-strong"
              />
              <Button type="submit">Save</Button>
            </form>
          ) : (
            <h1 className={cn(titleClass, "mt-2")}>
              {playlist.name}
            </h1>
          )}
          <MetaList className="mt-3" items={[formatCount(talks.length, "talk"), total ? formatDuration(total) : null]} />
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={playAll}
          disabled={!talks.length}
          className={cn(buttonClass("primary"), "pl-2 pr-5")}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
            <PlayGlyph playing={false} size={13} />
          </span>
          Play all
        </button>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger
            aria-label="Playlist options"
            className="press inline-flex size-11 items-center justify-center rounded-full text-ink-soft ring-1 ring-inset ring-line hover:bg-paper-sunken"
          >
            <MoreHorizontal size={18} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className={menuContentClass}>
              <DropdownMenu.Item className={menuItemClass} onSelect={() => setRenaming(true)}>
                <Pencil size={16} /> Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item className={cn(menuItemClass, "text-[oklch(0.55_0.17_28)]")} onSelect={() => void destroy()}>
                <Trash2 size={16} /> Delete playlist
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {talks.length ? (
        <ol className="divide-y divide-line">
          {talks.map((talk, index) => (
            <li key={talk.id}>
              <TalkRow
                talk={talk}
                context={talks}
                index={index + 1}
                trailing={
                  <span className="hidden items-center md:flex">
                    <IconAction label="Move up" disabled={index === 0} onClick={() => void move(index, -1)}>
                      <ArrowUp size={16} />
                    </IconAction>
                    <IconAction label="Move down" disabled={index === talks.length - 1} onClick={() => void move(index, 1)}>
                      <ArrowDown size={16} />
                    </IconAction>
                    <IconAction label={`Remove ${talk.title}`} onClick={() => void remove(talk)}>
                      <X size={16} />
                    </IconAction>
                  </span>
                }
              />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={<ListMusic size={20} />}
          title="This playlist is empty"
          action={<Link to="/talks" className={buttonClass("primary")}>Find talks</Link>}
        >
          Use “Add to playlist…” from any talk’s menu.
        </EmptyState>
      )}
    </>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink disabled:opacity-25"
    >
      {children}
    </button>
  );
}
