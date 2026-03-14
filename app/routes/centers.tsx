import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { centers, talks } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
import type { MetaFunction } from "react-router";
import { withCachedJson } from "~/lib/cache.server";
import { useState } from "react";
import { motion } from "motion/react";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction = () => {
  return [
    { title: "Meditation Centers - Dharma Radio" },
    {
      name: "description",
      content:
        "Explore dharma talks from meditation centers and Buddhist communities around the world",
    },
    { property: "og:title", content: "Meditation Centers - Dharma Radio" },
    {
      property: "og:description",
      content:
        "Explore dharma talks from meditation centers and Buddhist communities around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `centers:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "talks",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: centers.id,
          name: centers.name,
          slug: centers.slug,
          description: centers.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as(
            "talks_count",
          ),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
          ...totalCountField,
        })
        .from(centers)
        .leftJoin(talks, eq(talks.centerId, centers.id))
        .where(hasSearch ? like(centers.name, `%${searchQuery}%`) : undefined)
        .groupBy(centers.id)
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              talks: { column: sql`talks_count` },
              teachers: { column: sql`teachers_count` },
              retreats: { column: sql`retreats_count` },
            },
          }),
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 100 },
      });
    },
  );
}

export default function Centers() {
  const { items: centersList, pagination } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const currentSort = searchParams.get("sort") || "talks";
  const currentOrder = searchParams.get("order") || "desc";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      newParams.set("q", searchQuery.trim());
    } else {
      newParams.delete("q");
    }
    newParams.delete("page");
    setSearchParams(newParams);
  };

  const handleSort = (field: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (currentSort === field) {
      newParams.set("order", currentOrder === "asc" ? "desc" : "asc");
    } else {
      newParams.set("sort", field);
      newParams.set("order", "desc");
    }
    setSearchParams(newParams);
  };

  const goToPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(page));
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-4xl md:text-5xl font-serif font-light text-text-primary mb-2 tracking-tight leading-none">
          Centers
        </h1>
        <p className="text-text-tertiary text-sm font-light tracking-wide">
          {pagination.total.toLocaleString()} meditation centers
        </p>
      </motion.div>

      {/* Search and Sort Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-3 md:gap-6 pb-4 border-b border-text-primary/10"
      >
        <form onSubmit={handleSearch} className="w-full md:flex-1 md:max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search centers..."
            className="w-full px-0 py-2 border-b border-text-primary/15 bg-transparent focus:border-text-primary/40 focus:outline-none text-text-primary placeholder:text-text-tertiary/60 transition-colors text-sm"
          />
        </form>

        <div className="flex items-center gap-1 text-xs tracking-wide overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => handleSort("talks")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "talks"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Talks {currentSort === "talks" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
          <span className="text-text-tertiary/30">·</span>
          <button
            onClick={() => handleSort("teachers")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "teachers"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Teachers {currentSort === "teachers" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
          <span className="text-text-tertiary/30">·</span>
          <button
            onClick={() => handleSort("retreats")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "retreats"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Retreats {currentSort === "retreats" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
        </div>
      </motion.div>

      {/* Centers List */}
      <div className="space-y-0">
        {centersList.map((center, index) => (
          <motion.div
            key={center.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.005, duration: 0.2 }}
            className="group border-b border-text-primary/8 hover:bg-text-primary/[0.015] transition-all"
          >
            <Link to={`/centers/${center.slug}`} className="block py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-snug line-clamp-1">
                    {center.name}
                  </h3>
                </div>

                <div className="hidden md:flex items-center gap-3 text-xs text-text-tertiary shrink-0">
                  <span>{Number(center.talksCount)} talks</span>
                  {Number(center.teachersCount) > 0 && (
                    <span>{Number(center.teachersCount)} teachers</span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pt-6 pb-4 flex items-center justify-between border-t border-text-primary/10 mt-6"
        >
          <button
            onClick={() => goToPage(Math.max(1, pagination.current - 1))}
            disabled={pagination.current === 1}
            className="px-4 py-2 text-xs text-text-primary hover:text-text-primary/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            ← Previous
          </button>

          <div className="text-xs text-text-tertiary">
            {pagination.current} / {pagination.pages}
          </div>

          <button
            onClick={() => goToPage(Math.min(pagination.pages, pagination.current + 1))}
            disabled={pagination.current === pagination.pages}
            className="px-4 py-2 text-xs text-text-primary hover:text-text-primary/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next →
          </button>
        </motion.div>
      )}
    </div>
  );
}
