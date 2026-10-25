import { Link, useLocation } from "react-router";
import { Headphones, House, Search, Sprout } from "lucide-react";
import { useLibrary } from "~/contexts/library-context";
import { cn } from "~/lib/cn";
import { Avatar } from "~/components/ui/primitives";
import { BrandLink } from "~/components/brand";

/** A sun on the horizon, drawn to sit beside lucide's icons. */
export function SitGlyph({ size = 24, strokeWidth = 1.75, className }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M6.5 15a5.5 5.5 0 0 1 11 0" />
      <path d="M3 15h18M7 19h10" />
      <path d="M12 4.5v2" />
    </svg>
  );
}

/** Four destinations: arrive, sit, listen, look back. Everything else lives inside one of them. */
const destinations = [
  { to: "/", label: "Home", icon: House, match: (p: string) => p === "/" },
  { to: "/sit", label: "Sit", icon: SitGlyph, match: (p: string) => p === "/sit" },
  {
    to: "/listen",
    label: "Listen",
    icon: Headphones,
    match: (p: string) =>
      ["/listen", "/talks", "/teachers", "/retreats", "/centers", "/explore"].some((root) =>
        p.startsWith(root),
      ),
  },
  {
    to: "/practice",
    label: "Practice",
    icon: Sprout,
    match: (p: string) => p.startsWith("/practice") || p.startsWith("/library"),
  },
];

export function TopBar() {
  const { pathname } = useLocation();

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="px-shell mx-auto grid h-14 max-w-shell grid-cols-[1fr_auto] items-center gap-6 md:h-16 md:grid-cols-[1fr_auto_1fr]">
        <BrandLink />
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-0.5 rounded-full bg-paper-sunken/80 p-1">
            {destinations.map(({ to, label, match }) => {
              const active = match(pathname);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press flex h-9 items-center rounded-full px-4 text-[0.8125rem] lg:px-5",
                      active
                        ? "bg-paper-raised text-ink shadow-soft"
                        : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to="/talks"
            aria-label="Search talks"
            className="press inline-flex size-10 items-center justify-center rounded-full text-ink-faint hover:bg-paper-sunken hover:text-ink"
          >
            <Search size={19} />
          </Link>
          <AccountLink />
        </div>
      </div>
    </header>
  );
}

export function AccountLink() {
  const library = useLibrary();
  const user = library.user;
  const loading = library.status === "loading";

  return (
    <Link
      to={user ? "/account" : "/sign-in"}
      aria-label={user ? "Account" : undefined}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full transition-opacity",
        user && "w-10",
        loading && "opacity-0",
      )}
    >
      {user ? (
        <Avatar src={user.image} name={user.name || user.email} size={32} />
      ) : (
        <span className="inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[0.8125rem] ring-1 ring-inset ring-line-strong transition-colors hover:bg-paper-sunken">
          Sign in
        </span>
      )}
    </Link>
  );
}

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Primary" className="pb-safe border-t border-line bg-paper/90 backdrop-blur-md md:hidden">
      <ul className="mx-auto flex max-w-md">
        {destinations.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem]",
                  active ? "text-ink" : "text-ink-faint",
                )}
              >
                <Icon size={22} strokeWidth={1.75} className={cn(active && "text-accent-ink")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
