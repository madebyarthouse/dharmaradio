import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { db } from "~/db/client.server";
import { teachers } from "~/db/schema";
import { cacheHeader } from "pretty-cache-header";
import { cn } from "~/utils/cn";
import { Globe, Heart, ExternalLink } from "lucide-react";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.teacher) {
    return [{ title: "Teacher Not Found" }];
  }

  const { teacher } = data;
  return [
    { title: `${teacher.name} - Dharma Teacher - Dharma Radio` },
    { name: "description", content: teacher.description },
    {
      property: "og:title",
      content: `${teacher.name} - Dharma Teacher - Dharma Radio`,
    },
    { property: "og:description", content: teacher.description },
  ];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Teacher slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const teacher = await database.query.teachers.findFirst({
    where: eq(teachers.slug, slug),
  });

  if (!teacher) {
    throw new Response("Not Found", { status: 404 });
  }

  return { teacher };
}

export default function TeacherLayout() {
  const { teacher } = useLoaderData<typeof loader>();

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/60 backdrop-blur rounded-xl p-8 shadow-sm mb-8"
      >
        <div className="flex flex-col md:flex-row md:items-start md:space-x-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-6 md:mb-0"
          >
            <img
              src={teacher.profileImageUrl || ""}
              alt={teacher.name}
              className="w-32 h-32 rounded-full object-cover aspect-square ring-4 ring-green-100"
            />
          </motion.div>
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-serif mb-2 text-center md:text-left"
            >
              {teacher.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-green-800 mb-4"
            >
              {teacher.description}
            </motion.p>
            <div className="flex justify-center md:justify-start space-x-4">
              {teacher.websiteUrl && (
                <a
                  href={teacher.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-green-800 hover:text-green-900 transition-colors"
                >
                  <Globe size={16} />
                  <span>Website</span>
                  <ExternalLink size={12} />
                </a>
              )}
              {teacher.donationUrl && (
                <a
                  href={teacher.donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-green-800 hover:text-rose-500 transition-colors"
                >
                  <Heart size={16} />
                  <span>Support</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <nav className="flex gap-4 mb-8">
        <NavLink to="talks">Talks</NavLink>
        <NavLink to="centers">Centers</NavLink>
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
