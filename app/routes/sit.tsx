import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { useState } from "react";
import { useTimer } from "~/contexts/timer-context";
import { usePractice } from "~/contexts/practice-context";
import { useBreathPrefs } from "~/lib/breath-store";
import { BREATH_PATTERNS } from "~/lib/breath";
import { dayKey, minutesByDay, summarize } from "~/lib/practice";
import { minutesInWords, numberInWords } from "~/lib/format";
import { SitInstrument, type SitMode } from "~/components/sit-instrument";
import { SectionLink, titleClass } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

export const meta: MetaFunction = () => [
  { title: "Sit: a meditation timer with bells, Dharma Radio" },
  {
    name: "description",
    content: "A simple meditation timer: choose a length and a bell, add an interval bell or a breath guide, and begin.",
  },
];

// The same shell for everyone; settings live on the device. Cached offline by the service worker.
export const headers = () => ({
  "Cache-Control": cacheHeader({ maxAge: "1hour", sMaxage: "1day", staleWhileRevalidate: "1week" }),
});

const capitalize = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

function guidedBucket(minutes: number) {
  if (minutes <= 12) return "10";
  if (minutes <= 25) return "20";
  if (minutes <= 37) return "30";
  if (minutes <= 52) return "45";
  return "60";
}

export default function Sit() {
  const { settings } = useTimer();
  const prefs = useBreathPrefs();
  const [mode, setMode] = useState<SitMode>("sit");

  const lede =
    mode === "sit"
      ? `${capitalize(numberInWords(settings.startStrikes))} ${settings.startStrikes === 1 ? "bell" : "bells"} to begin, ${numberInWords(settings.endStrikes)} to close${
          settings.intervalMinutes ? `, and a soft bell every ${minutesInWords(settings.intervalMinutes)}.` : ", and quiet in between."
        }`
      : `${BREATH_PATTERNS[prefs.pattern].label}: ${BREATH_PATTERNS[prefs.pattern].summary.toLowerCase()}.`;

  return (
    <div className="animate-rise">
      <header className="pb-6 pt-7 md:pb-8 md:pt-12">
        <h1 className={titleClass}>
          {mode === "sit" ? "Sit for " : "Breathe for "}
          <span className="text-accent-ink">{minutesInWords(mode === "sit" ? settings.minutes : prefs.minutes)}</span>.
        </h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-sm leading-relaxed text-ink-soft md:text-[0.9375rem]">{lede}</p>
        <Today />
      </header>

      <SitInstrument mode={mode} onModeChange={setMode} />

      {mode === "sit" ? (
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-ink-soft">Rather be guided? Guided meditations of about this length.</p>
          <SectionLink to={`/talks?kind=guided&length=${guidedBucket(settings.minutes)}`}>Guided meditations</SectionLink>
        </div>
      ) : null}
    </div>
  );
}

/** What you've already sat, read from this device or your account. */
function Today() {
  const practice = usePractice();
  if (practice.status !== "ready" || practice.sessions.length === 0) return null;
  const today = Math.round(minutesByDay(practice.sessions).get(dayKey(Date.now())) ?? 0);
  const { daysThisWeek } = summarize(practice.sessions);
  return (
    <p className={cn("mt-4 text-xs text-ink-faint animate-fade")}>
      {today > 0 ? `${capitalize(minutesInWords(today))} today` : "Nothing yet today"}
      {daysThisWeek > 0 ? `, ${daysThisWeek} ${daysThisWeek === 1 ? "day" : "days"} this week.` : "."}{" "}
      <Link to="/practice" className="text-ink-soft underline decoration-line-strong underline-offset-4 hover:decoration-accent">
        Your practice
      </Link>
    </p>
  );
}
