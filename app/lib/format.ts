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
