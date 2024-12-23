import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { db } from "~/db/client.server";
import { retreats } from "~/db/schema";
import { cacheHeader } from "pretty-cache-header";
import { cn } from "~/utils/cn";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.retreat) {
    return [{ title: "Retreat Not Found" }];
  }

  const { retreat } = data;
  return [
    { title: `${retreat.title} - Dharma Radio` },
    { name: "description", content: retreat.description },
    { property: "og:title", content: `${retreat.title} - Dharma Radio` },
    { property: "og:description", content: retreat.description },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Retreat slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const retreat = await database.query.retreats.findFirst({
    where: eq(retreats.slug, slug),
  });

  if (!retreat) {
    throw new Response("Not Found", { status: 404 });
  }

  return { retreat };
}

export default function RetreatLayout() {
  const { retreat } = useLoaderData<typeof loader>();

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative rounded-xl overflow-hidden mb-8 shadow-sm"
      >
        <h1 className="text-4xl font-serif mb-2">{retreat.title}</h1>
        {retreat.description && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="col-span-2">
              <h2 className="text-xl font-medium mb-4">About this Retreat</h2>
              <p className="text-green-800 mb-6">{retreat.description}</p>
            </div>
          </div>
        )}
      </motion.div>

      <nav className="flex gap-4 mb-8">
        <NavLink to="talks">Talks</NavLink>
        <NavLink to="teachers">Teachers</NavLink>
      </nav>

      <Outlet context={{ retreat }} />
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname.endsWith(to);

  return (
    <Link
      to={to}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-green-100 text-green-900"
          : "text-green-800 hover:bg-green-50",
      )}
    >
      {children}
    </Link>
  );
}
