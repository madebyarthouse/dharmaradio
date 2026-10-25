/** A single heuristic shared by the catalogue query and player completion logging. */
export function isGuidedTitle(title: string): boolean {
  return /\bguided\b/i.test(title);
}
export const GUIDED_LENGTHS = [
  { key: "10", label: "About 10 min", minSec: 0, maxSec: 900 },
  { key: "20", label: "About 20 min", minSec: 900, maxSec: 1500 },
  { key: "30", label: "About 30 min", minSec: 1500, maxSec: 2280 },
  { key: "45", label: "About 45 min", minSec: 2280, maxSec: 3300 },
  { key: "60", label: "60 min or more", minSec: 3300, maxSec: Infinity },
] as const;
export type GuidedLengthKey = (typeof GUIDED_LENGTHS)[number]["key"];
