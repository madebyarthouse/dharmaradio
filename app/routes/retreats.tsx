import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { db } from "~/db/client.server";
import { retreats, talks } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { eq, like, sql } from "drizzle-orm";
import { cacheHeader } from "pretty-cache-header";
import type { MetaFunction } from "react-router";
import { withCachedJson } from "~/lib/cache.server";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
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
    { title: "Meditation Retreats - Dharma Radio" },
    {
      name: "description",
      content:
        "Browse meditation retreats and listen to retreat talks from teachers around the world",
    },
    { property: "og:title", content: "Meditation Retreats - Dharma Radio" },
    {
      property: "og:description",
      content:
        "Browse meditation retreats and listen to retreat talks from teachers around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `retreats:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "talks",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: retreats.id,
          slug: retreats.slug,
          title: retreats.title,
          description: retreats.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as(
            "talks_count",
          ),
          teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
            "teachers_count",
          ),
          ...totalCountField,
        })
        .from(retreats)
        .leftJoin(talks, eq(talks.retreatId, retreats.id))
        .where(hasSearch ? like(retreats.title, `%${searchQuery}%`) : undefined)
        .groupBy(retreats.id)
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              talks: { column: sql`talks_count` },
              teachers: { column: sql`teachers_count` },
              title: { column: retreats.title },
            },
          }),
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 20 },
      });
    },
  );
}

export default function Retreats() {
  const { items: retreatsList, pagination } = useLoaderData<typeof loader>();
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
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 md:py-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-16"
      >
        <h1 className="text-5xl md:text-7xl font-serif font-light text-text-primary mb-3 md:mb-4 tracking-tight leading-none">
          Retreats
        </h1>
        <p className="text-text-tertiary text-base md:text-lg font-light tracking-wide">
          {pagination.total.toLocaleString()} meditation retreats
        </p>
      </motion.div>

      {/* Search and Sort Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 md:mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 md:gap-8 pb-6 border-b border-text-primary/10"
      >
        <form onSubmit={handleSearch} className="w-full md:flex-1 md:max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search retreats..."
            className="w-full px-0 py-2.5 border-b-2 border-text-primary/15 bg-transparent focus:border-text-primary/40 focus:outline-none text-text-primary placeholder:text-text-tertiary/60 transition-colors text-sm md:text-base"
          />
        </form>

        <div className="flex items-center gap-1 text-xs md:text-sm tracking-wide overflow-x-auto w-full md:w-auto">
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
        </div>
      </motion.div>

      {/* Retreats List */}
      <div className="space-y-0">
        {retreatsList.map((retreat, index) => (
          <motion.div
            key={retreat.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.01, duration: 0.3 }}
            className="group border-b border-text-primary/8 hover:bg-text-primary/[0.015] transition-all"
          >
            <Link to={`/retreats/${retreat.slug}`} className="block py-5">
              <div className="flex items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-tight mb-2.5 italic">
                    {retreat.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-tertiary tracking-wide">
                    <span>{Number(retreat.talksCount)} talks</span>
                    {Number(retreat.teachersCount) > 0 && (
                      <>
                        <span className="text-text-tertiary/40">·</span>
                        <span>{Number(retreat.teachersCount)} teachers</span>
                      </>
                    )}
                  </div>
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
          className="pt-12 pb-4 flex items-center justify-between border-t border-text-primary/10 mt-8"
        >
          <button
            onClick={() => goToPage(Math.max(1, pagination.current - 1))}
            disabled={pagination.current === 1}
            className="px-5 py-2.5 text-sm text-text-primary hover:text-text-primary/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer tracking-wide"
          >
            ← Previous
          </button>

          <div className="text-sm text-text-tertiary tracking-wide">
            {pagination.current} / {pagination.pages}
          </div>

          <button
            onClick={() => goToPage(Math.min(pagination.pages, pagination.current + 1))}
            disabled={pagination.current === pagination.pages}
            className="px-5 py-2.5 text-sm text-text-primary hover:text-text-primary/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer tracking-wide"
          >
            Next →
          </button>
        </motion.div>
      )}
    </div>
  );
}
