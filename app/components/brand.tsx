import { Link } from "react-router";
import { cn } from "~/lib/cn";

/** A rising sun over a horizon line — dusk, and a dharma wheel's hub. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <circle cx="16" cy="16" r="15" fill="var(--accent)" opacity="0.14" />
      <path d="M8 19a8 8 0 0 1 16 0Z" fill="var(--accent)" />
      <path
        d="M5 19h22M9 23h14M13 27h6"
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLink({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-serif text-xl tracking-tight">Dharma Radio</span>
    </Link>
  );
}
