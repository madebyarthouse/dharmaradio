import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { eq, like, or } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";
import { Play } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useState, useEffect } from "react";
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
    { title: "Dharma Talks - Dharma Radio" },
    {
      name: "description",
      content:
        "Listen to thousands of dharma talks from teachers around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    [
      "talks",
      `page=${page}`,
      `q=${searchQuery}`,
      `sort=${sort.field}`,
      `order=${sort.order}`,
    ].join(":"),
    900,
    async () => {
      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: talks.id,
          title: talks.title,
          slug: talks.slug,
          duration: talks.duration,
          audioUrl: talks.audioUrl,
          publicationDate: talks.publicationDate,
          teacher: {
            name: teachers.name,
            slug: teachers.slug,
            profileImageUrl: teachers.profileImageUrl,
          },
          center: {
            name: centers.name,
            slug: centers.slug,
          },
          retreat: {
            title: retreats.title,
            slug: retreats.slug,
          },
          ...totalCountField,
        })
        .from(talks)
        .leftJoin(teachers, eq(talks.teacherId, teachers.id))
        .leftJoin(centers, eq(talks.centerId, centers.id))
        .leftJoin(retreats, eq(talks.retreatId, retreats.id))
        .where(
          hasSearch
            ? or(
                like(talks.title, `%${searchQuery}%`),
                like(teachers.name, `%${searchQuery}%`)
              )
            : undefined
        )
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              title: { column: talks.title },
              duration: { column: talks.duration },
              date: { column: talks.publicationDate },
            },
          })
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 25 },
      });
    }
  );
}

export default function Talks() {
  const { items: talksList, pagination } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playTalk, setPlaylist, currentTalk, isPlaying } = useAudio();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const currentSort = searchParams.get("sort") || "date";
  const currentOrder = searchParams.get("order") || "desc";

  // Update playlist whenever talks list changes
  useEffect(() => {
    const playlist = talksList.map(talk => ({
      id: String(talk.id),
      title: talk.title,
      teacher: talk.teacher?.name ?? null,
      teacherSlug: talk.teacher?.slug ?? null,
      centerName: talk.center?.name ?? null,
      centerSlug: talk.center?.slug ?? null,
      retreatTitle: talk.retreat?.title ?? null,
      retreatSlug: talk.retreat?.slug ?? null,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
    }));
    setPlaylist(playlist);
  }, [talksList, setPlaylist]);

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

  const handlePlayTalk = (talk: typeof talksList[0]) => {
    playTalk({
      id: String(talk.id),
      title: talk.title,
      teacher: talk.teacher?.name ?? null,
      teacherSlug: talk.teacher?.slug ?? null,
      centerName: talk.center?.name ?? null,
      centerSlug: talk.center?.slug ?? null,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
      retreatSlug: talk.retreat?.slug ?? null,
      retreatTitle: talk.retreat?.title ?? null,
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateInput: Date | number | string) => {
    const date =
      dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
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
          Talks
        </h1>
        <p className="text-text-tertiary text-sm font-light tracking-wide">
          {pagination.total.toLocaleString()} recordings
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
            placeholder="Search talks..."
            className="w-full px-0 py-2 border-b border-text-primary/15 bg-transparent focus:border-text-primary/40 focus:outline-none text-text-primary placeholder:text-text-tertiary/60 transition-colors text-sm"
          />
        </form>

        <div className="flex items-center gap-1 text-xs tracking-wide overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => handleSort("date")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "date"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Date {currentSort === "date" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
          <span className="text-text-tertiary/30">·</span>
          <button
            onClick={() => handleSort("title")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "title"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Title {currentSort === "title" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
          <span className="text-text-tertiary/30">·</span>
          <button
            onClick={() => handleSort("duration")}
            className={`px-3 py-2 transition-colors cursor-pointer ${
              currentSort === "duration"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Length {currentSort === "duration" && (currentOrder === "desc" ? "↓" : "↑")}
          </button>
        </div>
      </motion.div>

      {/* Talks List - 2 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {talksList.map((talk, index) => {
          const isCurrentlyPlaying = currentTalk?.id === String(talk.id) && isPlaying;

          return (
            <motion.div
              key={talk.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02, duration: 0.3 }}
              className="group"
            >
              <div className="flex items-start gap-3">
                {/* Play Button */}
                <button
                  onClick={() => handlePlayTalk(talk)}
                  className="shrink-0 mt-0.5 w-8 h-8 rounded-full border border-text-primary/20 flex items-center justify-center hover:border-text-primary hover:bg-text-primary/5 active:bg-text-primary active:text-white transition-all cursor-pointer"
                  aria-label={isCurrentlyPlaying ? "Pause" : "Play"}
                >
                  {isCurrentlyPlaying ? (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="w-1.5 h-1.5 bg-text-primary rounded-full"
                    />
                  ) : (
                    <Play size={12} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/talks/${talk.slug}`}
                    className="block group/link mb-1.5"
                  >
                    <h3 className="text-sm font-light text-text-primary group-hover/link:text-text-primary/60 transition-colors leading-snug">
                      {talk.title}
                    </h3>
                  </Link>

                  {/* Metadata - Stacked */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
                    {talk.teacher?.name && (
                      <>
                        {talk.teacher.profileImageUrl && (
                          <Link
                            to={`/teachers/${talk.teacher.slug}`}
                            className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-text-primary/5"
                          >
                            <img
                              src={talk.teacher.profileImageUrl}
                              alt={talk.teacher.name}
                              className="w-full h-full object-cover grayscale opacity-80"
                            />
                          </Link>
                        )}
                        <Link
                          to={`/teachers/${talk.teacher.slug}`}
                          className="hover:text-text-secondary transition-colors"
                        >
                          {talk.teacher.name}
                        </Link>
                        <span className="text-text-tertiary/40">·</span>
                      </>
                    )}
                    <span>{formatDate(talk.publicationDate)}</span>
                    <span className="text-text-tertiary/40">·</span>
                    <span className="tabular-nums">{formatDuration(talk.duration)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
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
