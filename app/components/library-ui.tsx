import { Library } from "lucide-react";
import { useLibrary } from "~/contexts/library-context";
import { AuthPanel } from "~/components/auth-panel";

/** Renders children only for signed-in users; otherwise an inline sign-in invitation. */
export function RequireAccount({
  children,
  title = "Your library lives here",
  description = "Sign in to save talks for later, keep the ones you love, build playlists and continue on any device.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const library = useLibrary();

  if (library.status === "loading") return <ListSkeleton />;
  if (library.user) return <>{children}</>;

  return (
    <div className="mt-4 grid max-w-4xl gap-10 rounded-[2rem] border border-line bg-paper-raised p-6 shadow-soft md:grid-cols-2 md:p-10">
      <div>
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
          <Library size={22} />
        </span>
        <h2 className="mt-5 text-balance font-serif text-3xl leading-tight tracking-tight">{title}</h2>
        <p className="mt-3 text-pretty text-ink-soft">{description}</p>
        <ul className="mt-6 space-y-2 text-sm text-ink-soft">
          <li>· Resume any talk exactly where you paused</li>
          <li>· Saved and liked talks, synced everywhere</li>
          <li>· Playlists for your sits, walks and retreats at home</li>
        </ul>
      </div>
      <AuthPanel />
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-paper-sunken" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-paper-sunken" />
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-paper-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
