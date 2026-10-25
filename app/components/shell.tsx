import { Link, NavLink, useLocation } from "react-router";
import {
  Bookmark,
  Building2,
  Clock3,
  Heart,
  History,
  Home,
  Library,
  ListMusic,
  Mic2,
  Mountain,
  Users,
} from "lucide-react";
import { useLibrary } from "~/contexts/library-context";
import { cn } from "~/lib/cn";
import { Avatar } from "~/components/ui/primitives";
import { BrandLink, BrandMark } from "~/components/brand";

const browse = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/talks", label: "Talks", icon: Mic2 },
  { to: "/teachers", label: "Teachers", icon: Users },
  { to: "/retreats", label: "Retreats", icon: Mountain },
  { to: "/centers", label: "Centers", icon: Building2 },
];

const libraryLinks = [
  { to: "/library/in-progress", label: "Continue", icon: Clock3 },
  { to: "/library/saved", label: "Saved", icon: Bookmark },
  { to: "/library/liked", label: "Liked", icon: Heart },
  { to: "/library/history", label: "History", icon: History },
];

function SideLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors",
          isActive
            ? "bg-paper-raised font-medium text-ink shadow-soft"
            : "text-ink-soft hover:bg-paper-sunken hover:text-ink",
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const library = useLibrary();

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-line lg:flex">
      <div className="px-6 pb-4 pt-7">
        <BrandLink />
      </div>
      <nav aria-label="Browse" className="flex flex-col gap-0.5 px-3">
        {browse.map((item) => (
          <SideLink key={item.to} {...item} />
        ))}
      </nav>

      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between px-6">
          <Link
            to="/library"
            className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
          >
            Your library
          </Link>
        </div>
        <nav aria-label="Library" className="flex flex-col gap-0.5 px-3">
          {libraryLinks.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>

        {library.playlists.length > 0 ? (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 scrollbar-none">
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Playlists
            </p>
            {library.playlists.map((playlist) => (
              <SideLink
                key={playlist.id}
                to={`/library/playlists/${playlist.id}`}
                label={playlist.name}
                icon={ListMusic}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <div className="border-t border-line p-3">
        <AccountLink variant="row" />
      </div>
    </aside>
  );
}

export function AccountLink({ variant }: { variant: "row" | "icon" }) {
  const library = useLibrary();
  const user = library.user;
  const loading = library.status === "loading";

  if (variant === "icon") {
    return (
      <Link
        to={user ? "/account" : "/sign-in"}
        aria-label={user ? "Account" : "Sign in"}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-full transition-transform active:scale-95",
          user && "w-10",
        )}
      >
        {user ? (
          <Avatar src={user.image} name={user.name || user.email} size={32} />
        ) : (
          <span
            className={cn(
              "inline-flex h-8 items-center whitespace-nowrap rounded-full border border-line-strong px-3 text-sm",
              loading && "opacity-0",
            )}
          >
            Sign in
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={user ? "/account" : "/sign-in"}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 transition-[background-color,opacity] hover:bg-paper-sunken",
        loading && "opacity-0",
      )}
    >
      {user ? (
        <>
          <Avatar src={user.image} name={user.name || user.email} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user.name || "Your account"}</span>
            <span className="block truncate text-xs text-ink-faint">{user.email}</span>
          </span>
        </>
      ) : (
        <>
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
            <Library size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Sign in</span>
            <span className="block text-xs text-ink-faint">Save talks & sync progress</span>
          </span>
        </>
      )}
    </Link>
  );
}

const tabs = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/talks", label: "Talks", icon: Mic2, match: (p: string) => p.startsWith("/talks") },
  {
    to: "/teachers",
    label: "Teachers",
    icon: Users,
    match: (p: string) => p.startsWith("/teachers"),
  },
  {
    to: "/explore",
    label: "Explore",
    icon: Mountain,
    match: (p: string) =>
      p.startsWith("/explore") || p.startsWith("/retreats") || p.startsWith("/centers"),
  },
  {
    to: "/library",
    label: "Library",
    icon: Library,
    match: (p: string) => p.startsWith("/library"),
  },
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="pb-safe border-t border-line bg-paper/90 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] transition-colors",
                  active ? "text-ink" : "text-ink-faint",
                )}
              >
                <Icon size={21} className={cn(active && "text-accent-ink")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileTopBar() {
  return (
    <div className="pt-safe sticky top-0 z-30 border-b border-transparent bg-paper/85 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size={26} />
          <span className="font-serif text-lg tracking-tight">Dharma Radio</span>
        </Link>
        <AccountLink variant="icon" />
      </div>
    </div>
  );
}
