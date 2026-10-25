export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${Math.max(1, minutes)} min`;
}

/** 0:00 / 1:02:03 style, for scrubbers. */
export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatRemaining(positionSec: number, durationSec: number) {
  const left = Math.max(0, durationSec - positionSec);
  if (left < 60) return "Almost done";
  return `${formatDuration(left)} left`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(input: Date | string | number | null | undefined) {
  if (input == null) return "";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

export function formatCount(n: number, singular: string, plural = `${singular}s`) {
  const value = Number(n) || 0;
  return `${value.toLocaleString("en-US")} ${value === 1 ? singular : plural}`;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 20 -> "twenty", 45 -> "forty-five". Numbers past 99 stay as figures. */
export function numberInWords(n: number) {
  const value = Math.round(n);
  if (value < 0 || value > 99) return value.toLocaleString("en-US");
  if (value < 20) return ONES[value];
  const rest = value % 10;
  return rest ? `${TENS[Math.floor(value / 10)]}-${ONES[rest]}` : TENS[value / 10];
}

/** Minutes as a phrase: "twenty minutes", "one minute", "an hour and a half". */
export function minutesInWords(minutes: number) {
  const m = Math.round(minutes);
  if (m === 60) return "an hour";
  if (m === 90) return "an hour and a half";
  return `${numberInWords(m)} ${m === 1 ? "minute" : "minutes"}`;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** The parts a calendar-like date block needs, in UTC like every other date here. */
export function dateParts(input: Date | string | number | null | undefined) {
  if (input == null) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return { day: date.getUTCDate(), month: monthFormatter.format(date), year: date.getUTCFullYear() };
}

/** "Mar 14 to 21, 2025", "Mar 30 to Apr 4, 2025", "Dec 28, 2024 to Jan 3, 2025". */
export function formatDateRange(
  from: Date | string | number | null | undefined,
  to: Date | string | number | null | undefined,
) {
  const a = dateParts(from);
  const b = dateParts(to);
  if (!a) return b ? formatDate(to) : "";
  if (!b || (a.day === b.day && a.month === b.month && a.year === b.year)) return formatDate(from);
  if (a.year !== b.year) return `${formatDate(from)} to ${formatDate(to)}`;
  if (a.month !== b.month) return `${a.month} ${a.day} to ${b.month} ${b.day}, ${b.year}`;
  return `${a.month} ${a.day} to ${b.day}, ${b.year}`;
}
