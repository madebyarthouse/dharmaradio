import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
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
    { title: "Dharma Teachers - Dharma Radio" },
    {
      name: "description",
      content:
        "Explore dharma talks from Buddhist teachers and meditation instructors from around the world",
    },
    { property: "og:title", content: "Dharma Teachers - Dharma Radio" },
    {
      property: "og:description",
      content:
        "Explore dharma talks from Buddhist teachers and meditation instructors from around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `teachers:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "talks",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as(
            "talks_count",
          ),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
          centersCount: sql<number>`count(distinct ${talks.centerId})`.as(
            "centers_count",
          ),
          ...totalCountField,
        })
        .from(teachers)
        .leftJoin(talks, eq(talks.teacherId, teachers.id))
        .where(hasSearch ? like(teachers.name, `%${searchQuery}%`) : undefined)
        .groupBy(teachers.id)
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              talks: { column: sql`talks_count` },
              retreats: { column: sql`retreats_count` },
              centers: { column: sql`centers_count` },
            },
          }),
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 25 },
      });
    },
  );
}

export default function Teachers() {
  const { items: teachersList, pagination } = useLoaderData<typeof loader>();
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
          Teachers
        </h1>
        <p className="text-text-tertiary text-sm font-light tracking-wide">
          {pagination.total.toLocaleString()} teachers
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
            placeholder="Search teachers..."
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
            onClick={() => handleSort("retreats")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "retreats"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Retreats {currentSort === "retreats" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
          <span className="text-text-tertiary/30">·</span>
          <button
            onClick={() => handleSort("centers")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "centers"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Centers {currentSort === "centers" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
        </div>
      </motion.div>

      {/* Teachers List - 2 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teachersList.map((teacher, index) => (
          <motion.div
            key={teacher.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.02, duration: 0.3 }}
            className="group"
          >
            <Link to={`/teachers/${teacher.slug}`} className="block">
              <div className="flex items-start gap-3">
                {/* Profile Image */}
                {teacher.profileImageUrl && (
                  <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full overflow-hidden bg-text-primary/5">
                    <img
                      src={teacher.profileImageUrl}
                      alt={teacher.name}
                      className="w-full h-full object-cover grayscale opacity-80"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-snug mb-1.5">
                    {teacher.name}
                  </h3>

                  {/* Stats - Stacked */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
                    <span>{Number(teacher.talksCount)} talks</span>
                    {Number(teacher.retreatsCount) > 0 && (
                      <>
                        <span className="text-text-tertiary/40">·</span>
                        <span>{Number(teacher.retreatsCount)} retreats</span>
                      </>
                    )}
                    {Number(teacher.centersCount) > 0 && (
                      <>
                        <span className="text-text-tertiary/40">·</span>
                        <span>{Number(teacher.centersCount)} centers</span>
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
