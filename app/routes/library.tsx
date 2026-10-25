import type { MetaFunction } from "react-router";
import { Link, useNavigate } from "react-router";
import { Bookmark, Clock3, Heart, History, ListMusic, Plus } from "lucide-react";
import { useLibrary } from "~/contexts/library-context";
import { useLibraryTalks } from "~/hooks/use-library-talks";
import { useUI } from "~/contexts/ui-context";
import { formatCount, formatDuration } from "~/lib/format";
import { noindex, shellHeaders } from "~/lib/shell-route";
import { TalkList } from "~/components/talk-row";
import { ListSkeleton, RequireAccount } from "~/components/library-ui";
import { Button, EmptyState, PageHeader, Section, SectionLink } from "~/components/ui/primitives";
import { useState } from "react";

export const meta: MetaFunction = () => [{ title: "Your library — Dharma Radio" }, noindex];
export const headers = shellHeaders;

export default function LibraryPage() {
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Library" title="Your practice, kept" />
      <RequireAccount>
        <LibraryOverview />
      </RequireAccount>
    </div>
  );
}

function LibraryOverview() {
  const library = useLibrary();
  const inProgress = [...library.progress.values()].filter((p) => !p.completed).length;

  const tiles = [
    { to: "/library/in-progress", label: "Continue", icon: Clock3, n: inProgress },
    { to: "/library/saved", label: "Saved", icon: Bookmark, n: library.savedIds.size },
    { to: "/library/liked", label: "Liked", icon: Heart, n: library.likedIds.size },
    { to: "/library/history", label: "History", icon: History, n: library.progress.size },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(({ to, label, icon: Icon, n }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-3xl border border-line bg-paper-raised p-5 transition-[transform,box-shadow] duration-300 ease-calm hover:-translate-y-0.5 hover:shadow-soft"
          >
            <Icon size={20} className="text-accent-ink" />
            <span className="mt-6 block font-serif text-3xl tabular-nums tracking-tight">{n}</span>
            <span className="block text-sm text-ink-soft">{label}</span>
          </Link>
        ))}
      </div>

      <Playlists />
      <ContinueSection />
    </>
  );
}

function Playlists() {
  const library = useLibrary();
  const ui = useUI();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    const playlist = await library.createPlaylist(name);
    ui.toast(`Created ${name}`);
    setCreating(false);
    navigate(`/library/playlists/${playlist.id}`);
  };

  return (
    <Section
      title="Playlists"
      action={
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <Plus size={15} /> New
        </button>
      }
    >
      {creating ? (
        <form onSubmit={create} className="mb-4 flex max-w-md gap-2">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Morning sits, Metta, …"
            aria-label="Playlist name"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-paper-raised px-4 outline-none focus:shadow-[0_0_0_4px_var(--accent-wash)]"
          />
          <Button type="submit">Create</Button>
          <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </form>
      ) : null}

      {library.playlists.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {library.playlists.map((playlist) => (
            <Link
              key={playlist.id}
              to={`/library/playlists/${playlist.id}`}
              className="group flex items-center gap-4 rounded-3xl border border-line bg-paper-raised p-4 transition-[transform,box-shadow] duration-300 ease-calm hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-wash text-accent-ink">
                <ListMusic size={22} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-serif text-lg">{playlist.name}</span>
                <span className="block text-sm text-ink-faint">
                  {formatCount(playlist.talkCount, "talk")}
                  {playlist.totalDurationSec ? ` · ${formatDuration(playlist.totalDurationSec)}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : !creating ? (
        <EmptyState
          icon={<ListMusic size={20} />}
          title="No playlists yet"
          action={<Button onClick={() => setCreating(true)}>Create a playlist</Button>}
        >
          Gather talks for a theme, a season of practice, or your evening sit.
        </EmptyState>
      ) : null}
    </Section>
  );
}

function ContinueSection() {
  const state = useLibraryTalks("in-progress");
  if (state.status === "loading" || state.status === "idle") {
    return (
      <Section title="Continue listening">
        <ListSkeleton rows={3} />
      </Section>
    );
  }
  if (state.status !== "ready" || state.talks.length === 0) return null;
  return (
    <Section title="Continue listening" action={<SectionLink to="/library/in-progress">See all</SectionLink>}>
      <TalkList talks={state.talks.slice(0, 5)} />
    </Section>
  );
}
