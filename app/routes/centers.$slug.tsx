import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { db } from "~/db/client.server";
import { centers } from "~/db/schema";
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
  if (!data?.center) {
    return [{ title: "Center Not Found" }];
  }

  const { center } = data;
  return [
    { title: `${center.name} - Dharma Radio` },
    { name: "description", content: center.description },
    { property: "og:title", content: `${center.name} - Dharma Radio` },
    { property: "og:description", content: center.description },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Center slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const center = await database.query.centers.findFirst({
    where: eq(centers.slug, slug),
  });

  if (!center) {
    throw new Response("Not Found", { status: 404 });
  }

  return { center };
}

export default function CenterLayout() {
  const { center } = useLoaderData<typeof loader>();

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-serif mb-4">{center.name}</h1>
        <p className="text-green-800">{center.description}</p>
      </motion.div>

      <nav className="flex gap-4 mb-8">
        <NavLink to="talks">Talks</NavLink>
        <NavLink to="teachers">Teachers</NavLink>
        <NavLink to="retreats">Retreats</NavLink>
      </nav>

      <Outlet />
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
