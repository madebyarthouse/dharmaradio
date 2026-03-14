import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { eq, sql, desc } from "drizzle-orm";
import { motion, AnimatePresence } from "motion/react";
import { Play } from "lucide-react";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";
import { useAudio } from "~/contexts/audio-context";
import { useState, useEffect } from "react";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const headers = () => cacheHeaders;

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

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Center slug is required");
  }

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `center:${slug}:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "date",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const center = await database.query.centers.findFirst({
        where: eq(centers.slug, slug),
      });

      if (!center) {
        throw new Response("Not Found", { status: 404 });
      }

      // Get talks
      const talksQuery = database
        .select({
          id: talks.id,
          slug: talks.slug,
          title: talks.title,
          audioUrl: talks.audioUrl,
          duration: talks.duration,
          publicationDate: talks.publicationDate,
          teacherName: teachers.name,
          teacherSlug: teachers.slug,
          teacherProfileImageUrl: teachers.profileImageUrl,
          retreatTitle: retreats.title,
          retreatSlug: retreats.slug,
          ...totalCountField,
        })
        .from(talks)
        .where(eq(talks.centerId, center.id))
        .leftJoin(teachers, eq(teachers.id, talks.teacherId))
        .leftJoin(retreats, eq(retreats.id, talks.retreatId))
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              date: { column: talks.publicationDate },
              title: { column: talks.title },
              duration: { column: talks.duration },
            },
          }),
        );

      // Get teachers
      const teachersQuery = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
        })
        .from(teachers)
        .innerJoin(talks, eq(talks.teacherId, teachers.id))
        .where(eq(talks.centerId, center.id))
        .groupBy(teachers.id);

      // Get retreats
      const retreatsQuery = database
        .select({
          id: retreats.id,
          title: retreats.title,
          slug: retreats.slug,
          description: retreats.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
        })
        .from(retreats)
        .innerJoin(talks, eq(talks.retreatId, retreats.id))
        .where(eq(talks.centerId, center.id))
        .groupBy(retreats.id);

      const [paginatedTalks, teachersData, retreatsData] = await Promise.all([
        withPagination({
          query: talksQuery.$dynamic(),
          params: { page, perPage: 50 },
        }),
        teachersQuery,
        retreatsQuery,
      ]);

      return {
        center,
        ...paginatedTalks,
        teachers: teachersData,
        retreats: retreatsData,
      };
    },
  );
}

export default function CenterDetail() {
  const {
    center,
    items: talksList,
    pagination,
    teachers: teachersList,
    retreats: retreatsList,
  } = useLoaderData<typeof loader>();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("talks");
  const { playTalk, setPlaylist, currentTalk, isPlaying } = useAudio();

  const currentSort = searchParams.get("sort") || "date";
  const currentOrder = searchParams.get("order") || "desc";

  // Update playlist whenever talks list changes
  useEffect(() => {
    const playlist = talksList.map((talk) => ({
      id: String(talk.id),
      title: talk.title,
      teacher: talk.teacherName ?? null,
      teacherSlug: talk.teacherSlug ?? null,
      centerName: center.name,
      centerSlug: center.slug,
      retreatTitle: talk.retreatTitle ?? null,
      retreatSlug: talk.retreatSlug ?? null,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
    }));
    setPlaylist(playlist);
  }, [talksList, setPlaylist, center.name, center.slug]);

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

  const handlePlayTalk = (talk: (typeof talksList)[0]) => {
    playTalk({
      id: String(talk.id),
      title: talk.title,
      teacher: talk.teacherName ?? null,
      teacherSlug: talk.teacherSlug ?? null,
      centerName: center.name,
      centerSlug: center.slug,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
      retreatSlug: talk.retreatSlug ?? null,
      retreatTitle: talk.retreatTitle ?? null,
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
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-serif font-light text-text-primary mb-3 tracking-tight leading-tight">
          {center.name}
        </h1>

        {/* Description */}
        {center.description && (
          <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
            {center.description}
          </p>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-6 border-b border-text-primary/10 mb-6">
          <button
            onClick={() => setActiveTab("talks")}
            className={`relative px-1 py-3 text-sm transition-colors ${
              activeTab === "talks"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Talks ({pagination.total})
            {activeTab === "talks" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("teachers")}
            className={`relative px-1 py-3 text-sm transition-colors ${
              activeTab === "teachers"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Teachers ({teachersList.length})
            {activeTab === "teachers" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("retreats")}
            className={`relative px-1 py-3 text-sm transition-colors ${
              activeTab === "retreats"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Retreats ({retreatsList.length})
            {activeTab === "retreats" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "talks" && (
            <motion.div
              key="talks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Sort Controls */}
              <div className="mb-6 flex items-center justify-between pb-4 border-b border-text-primary/10">
                <div className="text-xs text-text-tertiary">
                  {pagination.total.toLocaleString()} recordings
                </div>

                <div className="flex items-center gap-1 text-xs tracking-wide">
                  <button
                    onClick={() => handleSort("date")}
                    className={`px-3 py-2 transition-colors cursor-pointer ${
                      currentSort === "date"
                        ? "text-text-primary font-medium"
                        : "text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    Date{" "}
                    {currentSort === "date" &&
                      (currentOrder === "desc" ? "↓" : "↑")}
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
                    Title{" "}
                    {currentSort === "title" &&
                      (currentOrder === "desc" ? "↓" : "↑")}
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
                    Length{" "}
                    {currentSort === "duration" &&
                      (currentOrder === "desc" ? "↓" : "↑")}
                  </button>
                </div>
              </div>

              {/* Talks List - 2 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {talksList.map((talk, index) => {
                  const isCurrentlyPlaying =
                    currentTalk?.id === String(talk.id) && isPlaying;

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
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
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
                            {talk.teacherName && (
                              <>
                                {talk.teacherProfileImageUrl && (
                                  <Link
                                    to={`/teachers/${talk.teacherSlug}`}
                                    className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-text-primary/5"
                                  >
                                    <img
                                      src={talk.teacherProfileImageUrl}
                                      alt={talk.teacherName}
                                      className="w-full h-full object-cover grayscale opacity-80"
                                    />
                                  </Link>
                                )}
                                <Link
                                  to={`/teachers/${talk.teacherSlug}`}
                                  className="hover:text-text-secondary transition-colors"
                                >
                                  {talk.teacherName}
                                </Link>
                                <span className="text-text-tertiary/40">·</span>
                              </>
                            )}
                            <span>{formatDate(talk.publicationDate)}</span>
                            <span className="text-text-tertiary/40">·</span>
                            <span className="tabular-nums">
                              {formatDuration(talk.duration)}
                            </span>
                            {talk.retreatTitle && (
                              <>
                                <span className="text-text-tertiary/40">·</span>
                                <Link
                                  to={`/retreats/${talk.retreatSlug}`}
                                  className="italic hover:text-text-secondary transition-colors"
                                >
                                  {talk.retreatTitle}
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="pt-6 pb-4 flex items-center justify-between border-t border-text-primary/10 mt-6">
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
                    onClick={() =>
                      goToPage(Math.min(pagination.pages, pagination.current + 1))
                    }
                    disabled={pagination.current === pagination.pages}
                    className="px-4 py-2 text-xs text-text-primary hover:text-text-primary/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "teachers" && (
            <motion.div
              key="teachers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4 text-xs text-text-tertiary">
                {teachersList.length} teacher{teachersList.length !== 1 ? "s" : ""}
              </div>

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
                        {teacher.profileImageUrl && (
                          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full overflow-hidden bg-text-primary/5">
                            <img
                              src={teacher.profileImageUrl}
                              alt={teacher.name}
                              className="w-full h-full object-cover grayscale opacity-80"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-snug mb-1.5">
                            {teacher.name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
                            <span>{Number(teacher.talksCount)} talks</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "retreats" && (
            <motion.div
              key="retreats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4 text-xs text-text-tertiary">
                {retreatsList.length} retreat{retreatsList.length !== 1 ? "s" : ""}
              </div>

              {/* Retreats List - 2 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {retreatsList.map((retreat, index) => (
                  <motion.div
                    key={retreat.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02, duration: 0.3 }}
                    className="group"
                  >
                    <Link to={`/retreats/${retreat.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-snug mb-1.5 italic">
                            {retreat.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
                            <span>{Number(retreat.talksCount)} talks</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
