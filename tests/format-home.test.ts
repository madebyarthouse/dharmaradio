import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDateRange, dateParts } from "../app/lib/format.ts";
import { daySeed, varied } from "../app/lib/home.ts";

const d = (s: string) => Date.parse(`${s}T12:00:00Z`);

test("retreat date ranges read naturally", () => {
  assert.equal(formatDateRange(d("2025-03-14"), d("2025-03-21")), "Mar 14 to 21, 2025");
  assert.equal(formatDateRange(d("2025-03-30"), d("2025-04-04")), "Mar 30 to Apr 4, 2025");
  assert.equal(formatDateRange(d("2024-12-28"), d("2025-01-03")), "Dec 28, 2024 to Jan 3, 2025");
  assert.equal(formatDateRange(d("2025-03-14"), d("2025-03-14")), "Mar 14, 2025");
  assert.equal(formatDateRange(null, null), "");
  assert.deepEqual(dateParts(d("2025-03-14")), { day: 14, month: "Mar", year: 2025 });
});

test("the home shuffle seed holds for a whole UTC day and changes the next", () => {
  const morning = Date.parse("2026-10-25T00:00:01Z");
  const night = Date.parse("2026-10-25T23:59:59Z");
  const tomorrow = Date.parse("2026-10-26T00:00:00Z");
  assert.equal(daySeed(morning), daySeed(night));
  assert.equal(daySeed(tomorrow), daySeed(night) + 1);
});

test("shelves hold at most two talks from any one teacher", () => {
  const t = (slug: string, id: number) => ({ id, teacher: { slug } });
  const items = [t("a", 1), t("a", 2), t("a", 3), t("b", 4), t("a", 5), t("c", 6)];
  assert.deepEqual(varied(items, 4).map((i) => i.id), [1, 2, 4, 6]);
});
