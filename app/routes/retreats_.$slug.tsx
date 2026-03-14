import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { eq, like, sql } from "drizzle-orm";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import { db } from "~/db/client.server";
import { retreats, talks, teachers, centers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
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

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

  if (!slug) {
    throw new Error("Retreat slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const retreat = await database.query.retreats.findFirst({
    where: eq(retreats.slug, slug),
  });

  if (!retreat) {
    throw new Error("Retreat not found");
  }

  const baseQuery = database
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      duration: talks.duration,
      audioUrl: talks.audioUrl,
      publicationDate: talks.publicationDate,
      teacherName: teachers.name,
      teacherSlug: teachers.slug,
      teacherProfileImageUrl: teachers.profileImageUrl,
      centerName: centers.name,
      centerSlug: centers.slug,
      ...totalCountField,
    })
    .from(talks)
    .leftJoin(teachers, eq(teachers.id, talks.teacherId))
    .leftJoin(centers, eq(centers.id, talks.centerId))
    .where(eq(talks.retreatId, retreat.id));

  const query = hasSearch
    ? baseQuery.$dynamic().where(like(talks.title, `%${searchQuery}%`))
    : baseQuery;

  const finalQuery = query.orderBy(
    withOrdering({
      field: sort.field,
      order: sort.order,
      config: {
        date: { column: talks.publicationDate },
        title: { column: talks.title },
        teacher: { column: teachers.name },
      },
    }),
  );

  const teachersQuery = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
    })
    .from(teachers)
    .innerJoin(talks, eq(talks.teacherId, teachers.id))
    .where(eq(talks.retreatId, retreat.id))
    .groupBy(teachers.id);

  const [paginatedTalks, teachersData] = await Promise.all([
    withPagination({
      query: finalQuery.$dynamic(),
      params: { page, perPage: 50 },
    }),
    teachersQuery,
  ]);

  return {
    retreat,
    talks: paginatedTalks.items,
    pagination: paginatedTalks.pagination,
    teachers: teachersData,
  };
}

export default function RetreatDetail() {
  const { retreat, talks: talksList, pagination, teachers } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useState<"talks" | "teachers">("talks");
  const { playTalk, setPlaylist, currentTalk, isPlaying } = useAudio();

  const currentSort = searchParams.get("sort") || "date";
  const currentOrder = searchParams.get("order") || "desc";

  // Update playlist whenever talks list changes
  useEffect(() => {
    const playlist = talksList.map(talk => ({
      id: String(talk.id),
      title: talk.title,
      teacher: talk.teacherName ?? null,
      teacherSlug: talk.teacherSlug ?? null,
      centerName: talk.centerName ?? null,
      centerSlug: talk.centerSlug ?? null,
      retreatTitle: retreat.title,
      retreatSlug: retreat.slug,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
    }));
    setPlaylist(playlist);
  }, [talksList, setPlaylist, retreat.title, retreat.slug]);

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
      teacher: talk.teacherName ?? null,
      teacherSlug: talk.teacherSlug ?? null,
      centerName: talk.centerName ?? null,
      centerSlug: talk.centerSlug ?? null,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
      retreatSlug: retreat.slug,
      retreatTitle: retreat.title,
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

  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
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
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 md:py-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-12 pb-8 md:pb-12 border-b border-text-primary/10"
      >
        <h1 className="text-4xl md:text-6xl font-serif font-light text-text-primary mb-4 md:mb-6 tracking-tight leading-tight italic">
          {retreat.title}
        </h1>
        {talksList.length > 0 && talksList[0].centerName && (
          <Link
            to={`/centers/${talksList[0].centerSlug}`}
            className="inline-flex items-center gap-2 text-text-tertiary hover:text-text-secondary transition-colors text-sm md:text-base mb-3"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{talksList[0].centerName}</span>
          </Link>
        )}
        {retreat.description && (
          <p className="text-text-secondary text-sm md:text-base leading-relaxed font-light max-w-3xl">
            {retreat.description}
          </p>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 md:mb-12"
      >
        <div className="flex items-center gap-6 border-b border-text-primary/10">
          <button
            onClick={() => setActiveTab("talks")}
            className={`pb-3 px-1 text-sm md:text-base tracking-wide transition-colors relative ${
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
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("teachers")}
            className={`pb-3 px-1 text-sm md:text-base tracking-wide transition-colors relative ${
              activeTab === "teachers"
                ? "text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Teachers ({teachers.length})
            {activeTab === "teachers" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"
              />
            )}
          </button>
        </div>
      </motion.div>

      {/* Talks Tab */}
      {activeTab === "talks" && (
        <>
          {/* Search and Sort */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 md:mb-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 md:gap-8 pb-6 border-b border-text-primary/10"
          >
            <form onSubmit={handleSearch} className="w-full md:flex-1 md:max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search talks..."
                className="w-full px-0 py-2.5 border-b-2 border-text-primary/15 bg-transparent focus:border-text-primary/40 focus:outline-none text-text-primary placeholder:text-text-tertiary/60 transition-colors text-sm md:text-base"
              />
            </form>

            <div className="flex items-center gap-1 text-xs md:text-sm tracking-wide overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => handleSort("date")}
                className={`px-3 py-2 transition-colors cursor-pointer whitespace-nowrap ${
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
                className={`px-3 py-2 transition-colors cursor-pointer whitespace-nowrap ${
                  currentSort === "title"
                    ? "text-text-primary font-medium"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Title {currentSort === "title" && (currentOrder === "desc" ? "↓" : "↑")}
              </button>
              <span className="text-text-tertiary/30">·</span>
              <button
                onClick={() => handleSort("teacher")}
                className={`px-3 py-2 transition-colors cursor-pointer whitespace-nowrap ${
                  currentSort === "teacher"
                    ? "text-text-primary font-medium"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Teacher {currentSort === "teacher" && (currentOrder === "desc" ? "↓" : "↑")}
              </button>
            </div>
          </motion.div>

          {/* Talks List */}
          <div className="space-y-0">
            {talksList.map((talk, index) => {
              const isCurrentlyPlaying = currentTalk?.id === String(talk.id) && isPlaying;

              return (
                <motion.div
                  key={talk.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.01, duration: 0.3 }}
                  className="group border-b border-text-primary/8 hover:bg-text-primary/[0.015] transition-all"
                >
                  <div className="py-5 flex items-start gap-4 md:gap-5">
                    {/* Play Button */}
                    <button
                      onClick={() => handlePlayTalk(talk)}
                      className="shrink-0 mt-0.5 w-8 h-8 md:w-9 md:h-9 rounded-full border border-text-primary/25 flex items-center justify-center hover:border-text-primary hover:bg-text-primary/5 active:bg-text-primary active:text-white transition-all cursor-pointer"
                      aria-label={isCurrentlyPlaying ? "Pause" : "Play"}
                    >
                      {isCurrentlyPlaying ? (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="w-2 h-2 bg-text-primary rounded-full"
                        />
                      ) : (
                        <Play size={12} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/talks/${talk.slug}`}
                        className="block group/link mb-2"
                      >
                        <h3 className="text-base md:text-lg font-light text-text-primary group-hover/link:text-text-primary/60 transition-colors leading-tight">
                          {talk.title}
                        </h3>
                      </Link>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs md:text-sm text-text-tertiary tracking-wide">
                        {talk.teacherName && (
                          <Link
                            to={`/teachers/${talk.teacherSlug}`}
                            className="hover:text-text-secondary transition-colors font-medium"
                          >
                            {talk.teacherName}
                          </Link>
                        )}
                        <span className="text-text-tertiary/40">·</span>
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
        </>
      )}

      {/* Teachers Tab */}
      {activeTab === "teachers" && (
        <div className="space-y-0">
          {teachers.map((teacher, index) => (
            <motion.div
              key={teacher.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.01, duration: 0.3 }}
              className="group border-b border-text-primary/8 hover:bg-text-primary/[0.015] transition-all"
            >
              <Link to={`/teachers/${teacher.slug}`} className="block py-5">
                <div className="flex items-start gap-5 md:gap-6">
                  {/* Profile Image */}
                  {teacher.profileImageUrl && (
                    <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-text-primary/5">
                      <img
                        src={teacher.profileImageUrl}
                        alt={teacher.name}
                        className="w-full h-full object-cover grayscale opacity-80"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-light text-text-primary group-hover:text-text-primary/60 transition-colors leading-tight mb-2">
                      {teacher.name}
                    </h3>

                    <div className="text-xs md:text-sm text-text-tertiary tracking-wide">
                      {Number(teacher.talksCount)} talks
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
