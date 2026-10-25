export type PracticeKind = "timer" | "guided";
export type PracticeSession = {
  id: string;
  startedAt: number;
  durationSec: number;
  kind: PracticeKind;
  talkId: number | null;
  talkTitle?: string | null;
};

export function dayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function minutesByDay(
  sessions: readonly PracticeSession[],
): Map<string, number> {
  const days = new Map<string, number>();
  for (const session of sessions) {
    const key = dayKey(session.startedAt);
    days.set(key, (days.get(key) ?? 0) + session.durationSec / 60);
  }
  return days;
}

/** Calendar arithmetic stays local across DST. last7Minutes includes today and six prior days. */
export function summarize(
  sessions: readonly PracticeSession[],
  now = Date.now(),
) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  const seven = new Date(today);
  seven.setDate(seven.getDate() - 6);
  const past = sessions.filter((s) => s.startedAt <= now);
  const days = minutesByDay(past);
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let currentRunDays = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    currentRunDays++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    totalMinutes: past.reduce((n, s) => n + s.durationSec / 60, 0),
    sessionCount: past.length,
    last7Minutes: past
      .filter((s) => s.startedAt >= seven.getTime())
      .reduce((n, s) => n + s.durationSec / 60, 0),
    daysThisWeek: new Set(
      past
        .filter((s) => s.startedAt >= week.getTime())
        .map((s) => dayKey(s.startedAt)),
    ).size,
    currentRunDays,
  };
}
