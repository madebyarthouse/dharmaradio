import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { count } from "drizzle-orm";
import { Building2, Mic2, Mountain, Users } from "lucide-react";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { withCachedJson } from "~/lib/cache.server";
import { PageHeader } from "~/components/ui/primitives";

export const meta: MetaFunction = () => [
  { title: "Explore — Dharma Radio" },
  { name: "description", content: "Browse dharma talks by teacher, retreat and meditation center." },
];

export const headers = () => ({
  "Cache-Control": cacheHeader({ maxAge: "1hour", sMaxage: "1day", staleWhileRevalidate: "1week" }),
});

export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  return withCachedJson(env.DB_QUERY_CACHE, "explore:counts", 3600, async () => {
    const database = db(env.DB);
    const [[t], [te], [r], [c]] = await Promise.all([
      database.select({ n: count() }).from(talks),
      database.select({ n: count() }).from(teachers),
      database.select({ n: count() }).from(retreats),
      database.select({ n: count() }).from(centers),
    ]);
    return { talks: t?.n ?? 0, teachers: te?.n ?? 0, retreats: r?.n ?? 0, centers: c?.n ?? 0 };
  });
}

export default function Explore() {
  const counts = useLoaderData<typeof loader>();
  const items = [
    { to: "/retreats", label: "Retreats", body: "Listen through whole retreats, in order.", n: counts.retreats, icon: Mountain },
    { to: "/centers", label: "Centers", body: "Talks from the sanghas where they were given.", n: counts.centers, icon: Building2 },
    { to: "/teachers", label: "Teachers", body: "Follow a voice that speaks to you.", n: counts.teachers, icon: Users },
    { to: "/talks", label: "All talks", body: "The full archive, newest first.", n: counts.talks, icon: Mic2 },
  ];

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="Explore" title="Find your way in" />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ to, label, body, n, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group relative overflow-hidden rounded-3xl border border-line bg-paper-raised p-6 transition-[transform,box-shadow] duration-300 ease-calm hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-accent-wash" />
            <Icon size={22} className="relative text-accent-ink" />
            <span className="relative mt-8 block font-serif text-3xl tracking-tight">{label}</span>
            <span className="relative mt-1 block text-sm text-ink-soft">{body}</span>
            <span className="relative mt-4 block text-xs tabular-nums text-ink-faint">
              {n.toLocaleString("en-US")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
