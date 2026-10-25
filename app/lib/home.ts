const DAY_MS = 86_400_000;

/** Days since the epoch in UTC: one seed per calendar day, the same everywhere. */
export function daySeed(now: number) {
  return Math.floor(now / DAY_MS);
}

/** Newest first, with at most two talks from any one teacher, so a busy retreat day doesn't fill a shelf. */
export function varied<T extends { teacher: { slug: string } | null }>(items: T[], limit: number) {
  const perTeacher = new Map<string, number>();
  const out: T[] = [];
  for (const item of items) {
    const key = item.teacher?.slug ?? "";
    const seen = perTeacher.get(key) ?? 0;
    if (seen >= 2) continue;
    perTeacher.set(key, seen + 1);
    out.push(item);
    if (out.length === limit) break;
  }
  return out;
}
