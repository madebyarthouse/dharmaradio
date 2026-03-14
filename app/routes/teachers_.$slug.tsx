import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { eq, sql, desc } from "drizzle-orm";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Heart, ExternalLink, Play } from "lucide-react";
import { db } from "~/db/client.server";
import { teachers, talks, centers, retreats } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";
import { useAudio } from "~/contexts/audio-context";
import { useState, useEffect } from "react";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "7days",
    staleWhileRevalidate: "1month",
  }),
};

export const headers = () => cacheHeaders;

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

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Teacher slug is required");
  }

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `teacher:${slug}:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "date",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const teacherQuery = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          websiteUrl: teachers.websiteUrl,
          donationUrl: teachers.donationUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
          retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
            "retreats_count",
          ),
          centersCount: sql<number>`count(distinct ${talks.centerId})`.as(
            "centers_count",
          ),
        })
        .from(teachers)
        .leftJoin(talks, eq(talks.teacherId, teachers.id))
        .where(eq(teachers.slug, slug))
        .groupBy(teachers.id);

      const [teacher] = await teacherQuery.execute();

      if (!teacher) {
        throw new Error("Teacher not found");
      }

      const talksQuery = database
        .select({
          id: talks.id,
          slug: talks.slug,
          title: talks.title,
          duration: talks.duration,
          audioUrl: talks.audioUrl,
          publicationDate: talks.publicationDate,
          centerName: centers.name,
          centerSlug: centers.slug,
          retreatTitle: retreats.title,
          retreatSlug: retreats.slug,
          ...totalCountField,
        })
        .from(talks)
        .leftJoin(centers, eq(talks.centerId, centers.id))
        .leftJoin(retreats, eq(talks.retreatId, retreats.id))
        .where(eq(talks.teacherId, teacher.id))
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              title: { column: talks.title },
              duration: { column: talks.duration },
              date: { column: talks.publicationDate },
            },
          }),
        );

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
        .where(eq(talks.teacherId, teacher.id))
        .groupBy(retreats.id);

      const centersQuery = database
        .select({
          id: centers.id,
          name: centers.name,
          slug: centers.slug,
          description: centers.description,
          talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
        })
        .from(centers)
        .innerJoin(talks, eq(talks.centerId, centers.id))
        .where(eq(talks.teacherId, teacher.id))
        .groupBy(centers.id);

      const [paginatedTalks, retreatsData, centersData] = await Promise.all([
        withPagination({
          query: talksQuery.$dynamic(),
          params: { page, perPage: 50 },
        }),
        retreatsQuery,
        centersQuery,
      ]);

      return {
        teacher,
        ...paginatedTalks,
        retreats: retreatsData,
        centers: centersData,
      };
    },
  );
}

export default function TeacherDetail() {
  const {
    teacher,
    items: talksList,
    pagination,
    retreats: retreatsList,
    centers: centersList,
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
      teacher: teacher.name,
      teacherSlug: teacher.slug,
      centerName: talk.centerName ?? null,
      centerSlug: talk.centerSlug ?? null,
      retreatTitle: talk.retreatTitle ?? null,
      retreatSlug: talk.retreatSlug ?? null,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
    }));
    setPlaylist(playlist);
  }, [talksList, setPlaylist, teacher.name, teacher.slug]);

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
      teacher: teacher.name,
      teacherSlug: teacher.slug,
      centerName: talk.centerName ?? null,
      centerSlug: talk.centerSlug ?? null,
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
        <div className="flex items-start gap-6 mb-6">
          {/* Profile Image */}
          {teacher.profileImageUrl && (
            <div className="shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-text-primary/5 border border-text-primary/10">
              <img
                src={teacher.profileImageUrl}
                alt={teacher.name}
                className="w-full h-full object-cover grayscale opacity-90"
              />
            </div>
          )}

          {/* Teacher Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-serif font-light text-text-primary mb-3 tracking-tight leading-tight">
              {teacher.name}
            </h1>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-tertiary mb-4">
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

            {/* Links */}
            {(teacher.websiteUrl || teacher.donationUrl) && (
              <div className="flex flex-wrap items-center gap-3">
                {teacher.websiteUrl && (
                  <a
                    href={teacher.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-text-primary/20 rounded-full hover:border-text-primary/40 hover:bg-text-primary/5 transition-colors"
                  >
                    <Globe size={12} />
                    <span>Website</span>
                    <ExternalLink size={10} />
                  </a>
                )}
                {teacher.donationUrl && (
                  <a
                    href={teacher.donationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-text-primary/20 rounded-full hover:border-text-primary/40 hover:bg-text-primary/5 transition-colors"
                  >
                    <Heart size={12} />
                    <span>Support</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {teacher.description && (
          <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
            {teacher.description}
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
          <button
            onClick={() => setActiveTab("centers")}
            className={`relative px-1 py-3 text-sm transition-colors ${
              activeTab === "centers"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Centers ({centersList.length})
            {activeTab === "centers" && (
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
                            {talk.centerName && (
                              <>
                                <span className="text-text-tertiary/40">·</span>
                                <Link
                                  to={`/centers/${talk.centerSlug}`}
                                  className="hover:text-text-secondary transition-colors"
                                >
                                  {talk.centerName}
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

          {activeTab === "centers" && (
            <motion.div
              key="centers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4 text-xs text-text-tertiary">
                {centersList.length} center{centersList.length !== 1 ? "s" : ""}
              </div>

              {/* Centers List - 2 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {centersList.map((center, index) => (
                  <motion.div
                    key={center.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02, duration: 0.3 }}
                    className="group"
                  >
                    <Link to={`/centers/${center.slug}`} className="block">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-snug mb-1.5">
                            {center.name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
                            <span>{Number(center.talksCount)} talks</span>
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
