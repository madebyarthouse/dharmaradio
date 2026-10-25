import type { MetaFunction } from "react-router";
import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListMusic, Plus, X } from "lucide-react";
import { usePractice } from "~/contexts/practice-context";
import { useLibrary } from "~/contexts/library-context";
import { useLibraryTalks } from "~/hooks/use-library-talks";
import { useUI } from "~/contexts/ui-context";
import { dayKey, minutesByDay, summarize, type PracticeSession } from "~/lib/practice";
import { formatCount, formatDuration } from "~/lib/format";
import { noindex, shellHeaders } from "~/lib/shell-route";
import { TalkList } from "~/components/talk-row";
import { ListSkeleton, RequireAccount } from "~/components/library-ui";
import { Button, buttonClass, PageHeader, Section, SectionLink } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

export const meta: MetaFunction = () => [{ title: "Your practice, Dharma Radio" }, noindex];
export const headers = shellHeaders;

export default function PracticePage() {
  return (
    <div className="animate-rise">
      <PageHeader title="Your practice" />
      <Record />
      <Section title="Your library">
        <RequireAccount
          title="Keep talks for later"
          description="Sign in to save talks, keep the ones you love, build playlists and pick up any talk where you paused."
        >
          <Shelves />
          <Playlists />
          <ContinueSection />
        </RequireAccount>
      </Section>
    </div>
  );
}

/* ---------- The record of sits ---------- */

function Record() {
  const practice = usePractice();
  const library = useLibrary();

  if (practice.status !== "ready") {
    return <div aria-busy="true" className="h-64 border-t border-line" />;
  }

  if (practice.sessions.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-paper-raised px-6 py-10 ring-1 ring-inset ring-line md:px-10">
        <div className="relative max-w-lg">
          <h2 className="font-serif text-[1.75rem] leading-tight tracking-[-0.01em]">Nothing here yet</h2>
          <p className="mt-3 text-pretty text-ink-soft">
            Each sit you finish with the timer, each breathing practice and each guided
            meditation you hear to the end is kept here, day by day.
          </p>
          <Link to="/sit" className={cn(buttonClass("secondary"), "mt-6")}>
            Sit for a few minutes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Figures sessions={practice.sessions} />
      <Calendar sessions={practice.sessions} />
      {!library.user && library.status !== "loading" ? (
        <p className="mt-4 text-[0.8125rem] text-ink-faint">
          Kept on this device.{" "}
          <Link
            to="/sign-in?next=/practice"
            className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent"
          >
            Sign in
          </Link>{" "}
          to keep it on every device.
        </p>
      ) : null}
      <Recent sessions={practice.sessions} onRemove={practice.remove} />
    </>
  );
}

function Figures({ sessions }: { sessions: PracticeSession[] }) {
  const s = summarize(sessions);
  const hours = s.totalMinutes / 60;
  const figures = [
    { value: s.daysThisWeek, label: s.daysThisWeek === 1 ? "day this week" : "days this week" },
    { value: Math.round(s.last7Minutes), label: "minutes, last 7 days" },
    { value: s.currentRunDays, label: s.currentRunDays === 1 ? "day in a row" : "days in a row" },
    {
      value: hours >= 1 ? Math.round(hours * 10) / 10 : Math.round(s.totalMinutes),
      label: hours >= 1 ? "hours in all" : "minutes in all",
    },
  ];
  return (
    <dl className="grid grid-cols-2 border-t border-line md:grid-cols-4">
      {figures.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            "flex flex-col-reverse py-5 md:py-6",
            i % 2 === 1 && "border-l border-line pl-5",
            i >= 2 && "border-t border-line md:border-t-0",
            i === 2 && "md:border-l md:pl-5",
          )}
        >
          <dt className="mt-1 text-[0.8125rem] text-ink-faint">{f.label}</dt>
          <dd className="font-serif text-[2.75rem] leading-none tracking-[-0.02em] tabular-nums md:text-[3.25rem]">
            {f.value.toLocaleString("en-US")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const WEEKS = 26;

/** Minutes sat per day for the last 26 weeks, Monday at the top. A chart, not a streak. */
function Calendar({ sessions }: { sessions: PracticeSession[] }) {
  const { weeks, max } = useMemo(() => {
    const days = minutesByDay(sessions);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (WEEKS - 1) * 7);
    const weeks: { key: string; date: Date; minutes: number; future: boolean }[][] = [];
    let max = 0;
    for (let w = 0; w < WEEKS; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const key = dayKey(date.getTime());
        const minutes = days.get(key) ?? 0;
        max = Math.max(max, minutes);
        week.push({ key, date, minutes, future: date > today });
      }
      weeks.push(week);
    }
    return { weeks, max };
  }, [sessions]);

  const level = (minutes: number) => {
    if (minutes <= 0) return 0;
    const ratio = minutes / Math.max(max, 30);
    return ratio > 0.75 ? 4 : ratio > 0.45 ? 3 : ratio > 0.2 ? 2 : 1;
  };

  const sat = weeks.flat().filter((d) => d.minutes > 0).length;
  // On narrow screens the chart scrolls; open it on the most recent weeks.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);
  const cell = "size-3.5 rounded-[3px] sm:size-4 lg:size-[1.125rem]";

  return (
    <figure className="border-t border-line pt-6">
      <div ref={scroller} className="overflow-x-auto scrollbar-none">
        <div
          role="img"
          aria-label={`Minutes sat each day over the last ${WEEKS} weeks. You sat on ${sat} of those days.`}
          className="grid w-max grid-cols-[auto_auto] gap-x-2"
        >
          <span />
          {/* Month names over the week in which each month begins. */}
          <div aria-hidden className="mb-1.5 grid grid-flow-col gap-[3px] text-xs text-ink-faint">
            {weeks.map((week, i) => {
              const first = week.find((d) => d.date.getDate() === 1);
              return (
                <span key={week[0].key} className={cn(cell, "relative !h-4 bg-transparent")}>
                  {first || i === 0 ? (
                    <span className="absolute left-0 top-0 whitespace-nowrap">
                      {(first ?? week[0]).date.toLocaleDateString([], { month: "short" })}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <div aria-hidden className="grid grid-rows-7 gap-[3px] text-xs leading-none text-ink-faint">
            {["Mon", "", "Wed", "", "Fri", "", ""].map((label, i) => (
              <span key={i} className="flex h-3.5 items-center sm:h-4 lg:h-[1.125rem]">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col gap-[3px] [grid-template-rows:repeat(7,minmax(0,1fr))]">
            {weeks.flat().map((day) => (
              <span
                key={day.key}
                title={
                  day.future
                    ? undefined
                    : `${day.date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${
                        day.minutes ? formatDuration(day.minutes * 60) : "no sit"
                      }`
                }
                className={cn(
                  cell,
                  day.future
                    ? "bg-transparent"
                    : ["bg-paper-sunken", "bg-accent/30", "bg-accent/55", "bg-accent/80", "bg-accent"][
                        level(day.minutes)
                      ],
                )}
              />
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-faint">
        <span>Minutes sat each day, the last six months.</span>
        <span aria-hidden className="flex items-center gap-1.5">
          Less
          {["bg-paper-sunken", "bg-accent/30", "bg-accent/55", "bg-accent/80", "bg-accent"].map((tone) => (
            <span key={tone} className={cn("size-3 rounded-[3px]", tone)} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}

function sessionDay(ms: number) {
  const key = dayKey(ms);
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function Recent({ sessions, onRemove }: { sessions: PracticeSession[]; onRemove: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? sessions : sessions.slice(0, 8);

  return (
    <Section title="Recent sits" className="mt-10">
      <table className="w-full text-left">
        <thead className="sr-only">
          <tr>
            <th>Day</th>
            <th>Practice</th>
            <th>Length</th>
            <th>Remove</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-y border-line">
          {shown.map((s) => (
            <tr key={s.id} className="group">
              <td className="w-36 py-3.5 pr-4 align-top text-[0.8125rem] text-ink-faint">
                {sessionDay(s.startedAt)}
                <span className="block text-[0.8125rem]">
                  {new Date(s.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </td>
              <td className="py-3.5 pr-4 align-top">
                {s.kind === "guided" && s.talkId ? (
                  <span className="font-serif text-[1.125rem] leading-snug">
                    {s.talkTitle ?? "Guided meditation"}
                    <span className="mt-0.5 block font-sans text-[0.8125rem] text-ink-faint">Guided</span>
                  </span>
                ) : (
                  <span className="font-serif text-[1.125rem] leading-snug">
                    Timed sit
                    <span className="mt-0.5 block font-sans text-[0.8125rem] text-ink-faint">With the timer</span>
                  </span>
                )}
              </td>
              <td className="w-24 py-3.5 text-right align-top text-[0.8125rem] tabular-nums">
                {formatDuration(s.durationSec)}
              </td>
              <td className="w-12 py-2 text-right align-top">
                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  aria-label={`Remove the ${sessionDay(s.startedAt).toLowerCase()} sit`}
                  className="inline-flex size-10 items-center justify-center rounded-full text-ink-faint opacity-60 transition-[opacity,color,background-color] hover:bg-paper-sunken hover:text-ink hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length > 8 ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-4 text-[0.8125rem] text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          {all ? "Show fewer" : `Show all ${sessions.length}`}
        </button>
      ) : null}
    </Section>
  );
}

/* ---------- The library ---------- */

function Shelves() {
  const library = useLibrary();
  const inProgress = [...library.progress.values()].filter((p) => !p.completed).length;
  const shelves = [
    { to: "/library/in-progress", label: "Continue listening", n: inProgress },
    { to: "/library/saved", label: "Saved for later", n: library.savedIds.size },
    { to: "/library/liked", label: "Liked", n: library.likedIds.size },
    { to: "/library/history", label: "Listening history", n: library.progress.size },
  ];
  return (
    <ul className="grid grid-cols-1 border-t border-line md:grid-cols-2 md:gap-x-10">
      {shelves.map((shelf) => (
        <li key={shelf.to} className="border-b border-line">
          <Link
            to={shelf.to}
            className="flex h-16 items-center justify-between gap-4 transition-colors hover:text-accent-ink"
          >
            <span className="font-serif text-[1.25rem] tracking-[-0.01em]">{shelf.label}</span>
            <span className="text-[0.8125rem] tabular-nums text-ink-faint">{shelf.n}</span>
          </Link>
        </li>
      ))}
    </ul>
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
    <div className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-[1.375rem] tracking-[-0.01em]">Playlists</h3>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] text-ink-faint transition-colors hover:bg-paper-sunken hover:text-ink"
          >
            <Plus size={16} /> New playlist
          </button>
        ) : null}
      </div>

      {creating ? (
        <form onSubmit={create} className="mb-4 flex max-w-md gap-2">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Morning sits"
            aria-label="Playlist name"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="h-11 min-w-0 flex-1 rounded-full bg-paper-sunken px-4 outline-none ring-1 ring-inset ring-transparent focus:bg-paper-raised focus:ring-line-strong"
          />
          <Button type="submit">Create</Button>
          <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </form>
      ) : null}

      {library.playlists.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {library.playlists.map((playlist) => (
            <li key={playlist.id}>
              <Link
                to={`/library/playlists/${playlist.id}`}
                className="group flex items-center gap-4 py-3 transition-colors hover:text-accent-ink"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-paper-sunken text-ink-soft ring-1 ring-inset ring-line group-hover:text-accent-ink">
                  <ListMusic size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate font-serif text-[1.1875rem] tracking-[-0.005em]">{playlist.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                  {formatCount(playlist.talkCount, "talk")}
                  {playlist.totalDurationSec ? `, ${formatDuration(playlist.totalDurationSec)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : !creating ? (
        <p className="border-t border-line py-6 text-[0.8125rem] text-ink-faint">
          Gather talks for a theme, a season of practice or your evening sit.
        </p>
      ) : null}
    </div>
  );
}

function ContinueSection() {
  const state = useLibraryTalks("in-progress");
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="mt-10">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (state.status !== "ready" || state.talks.length === 0) return null;
  return (
    <div className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="font-serif text-[1.375rem] tracking-[-0.01em]">Continue listening</h3>
        <SectionLink to="/library/in-progress">See all</SectionLink>
      </div>
      <TalkList talks={state.talks.slice(0, 4)} />
    </div>
  );
}
