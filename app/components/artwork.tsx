import type { CSSProperties } from "react";
import { cn } from "~/lib/cn";

/** A small, stable hash so a talk always gets the same generated cover. */
function hash(input: string | number) {
  let h = 2166136261;
  for (const ch of String(input)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

/**
 * Square, album-like artwork for a talk: the teacher's portrait when there is one,
 * otherwise a generated cover, a low sun on a horizon drawn from the theme's tokens.
 */
export function TalkArt({
  src,
  seed,
  name,
  size,
  className,
  style,
}: {
  src: string | null | undefined;
  /** Anything stable: the talk or teacher id. */
  seed: string | number;
  /** Used for the cover's initials when there is no image. */
  name: string;
  /** Pixel size; omit to fill the parent's width. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const box: CSSProperties = size ? { width: size, height: size, ...style } : { ...style };
  return (
    <span
      className={cn(
        "relative block aspect-square shrink-0 overflow-hidden rounded-[var(--art-radius,0.5rem)] bg-paper-sunken ring-1 ring-inset ring-line",
        !size && "w-full",
        className,
      )}
      style={box}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover saturate-[.85]"
        />
      ) : (
        <GeneratedCover seed={seed} name={name} small={size !== undefined && size < 56} />
      )}
    </span>
  );
}

function GeneratedCover({ seed, name, small }: { seed: string | number; name: string; small: boolean }) {
  const h = hash(seed);
  const sunX = 22 + (h % 56); // 22..77 %
  const horizon = 58 + ((h >> 6) % 18); // 58..75 %
  const warmth = 14 + ((h >> 11) % 22); // how much saffron in the sky
  const sun = 14 + ((h >> 16) % 10); // sun radius, % of width

  return (
    <span
      aria-hidden
      className="absolute inset-0"
      style={{
        background: [
          // The sun, cut off at the horizon by the ground layer below.
          `radial-gradient(circle at ${sunX}% ${horizon}%, var(--accent) 0 ${sun}%, transparent ${sun + 0.5}%)`,
          `linear-gradient(to bottom, color-mix(in oklch, var(--accent) ${warmth}%, var(--paper-sunken)) 0%, var(--paper-sunken) ${horizon}%)`,
        ].join(","),
      }}
    >
      <span
        className="absolute inset-x-0 bottom-0 bg-paper-sunken"
        style={{ top: `${horizon}%`, boxShadow: "inset 0 1px 0 var(--line-strong)" }}
      />
      {small ? null : (
        <span className="absolute bottom-[8%] left-[9%] font-mono text-[0.6875rem] text-ink-faint">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
