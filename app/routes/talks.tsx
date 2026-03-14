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
import { Play, Search, Filter } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";

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
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `talks:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "date",
        order: "desc",
      });

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
        params: { page, perPage: 24 },
      });
    }
  );
}

export default function Talks() {
  const { items: talksList, pagination } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playTalk, setPlaylist } = useAudio();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);

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
    newParams.delete("page"); // Reset to first page
    setSearchParams(newParams);
  };

  const handleSort = (field: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (currentSort === field) {
      // Toggle order
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
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const goToPage = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(page));
    setSearchParams(newParams);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header with Search */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-text-primary">Talks</h1>
            <p className="text-sm text-text-secondary mt-1">
              {pagination.total.toLocaleString()} talks available
            </p>
          </div>

          <Button onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter size={16} />
            Filters
          </Button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch}>
          <div className="neumorphic-card-pressed rounded-full flex items-center px-6 py-3 gap-4">
            <Search size={18} className="text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search talks or teachers..."
              className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary"
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </div>
        </form>

        {/* Sort Options */}
        {showFilters && (
          <div className="neumorphic-card rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-3">
                Sort by
              </label>
              <div className="flex gap-2">
                {[
                  { value: "date", label: "Date" },
                  { value: "title", label: "Title" },
                  { value: "duration", label: "Duration" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => handleSort(option.value)}
                    variant={currentSort === option.value ? "pressed" : "ghost"}
                  >
                    {option.label}
                    {currentSort === option.value && (
                      <span className="ml-1">
                        {currentOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Talks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {talksList.map((talk) => (
          <div key={talk.id} className="neumorphic-card rounded-2xl p-6 space-y-4 group">
            <div className="flex items-start gap-4">
              {talk.teacher?.profileImageUrl && (
                <div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 bg-cover bg-center flex-shrink-0"
                  style={{
                    backgroundImage: `url(${talk.teacher.profileImageUrl})`,
                    filter: "grayscale(90%) contrast(1.05)",
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <Link to={`/talks/${talk.slug}`} className="block">
                  <h3 className="font-medium text-text-primary line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {talk.title}
                  </h3>
                </Link>
                {talk.teacher?.name && (
                  <p className="text-sm text-text-secondary mt-1 truncate">
                    {talk.teacher.slug ? (
                      <Link
                        to={`/teachers/${talk.teacher.slug}`}
                        className="hover:text-text-primary"
                      >
                        {talk.teacher.name}
                      </Link>
                    ) : (
                      talk.teacher.name
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-2 text-xs text-text-tertiary">
              {talk.center?.name && (
                <div className="truncate">
                  at{" "}
                  {talk.center.slug ? (
                    <Link
                      to={`/centers/${talk.center.slug}`}
                      className="hover:text-text-secondary"
                    >
                      {talk.center.name}
                    </Link>
                  ) : (
                    talk.center.name
                  )}
                </div>
              )}
              {talk.retreat?.title && (
                <div className="truncate">
                  {talk.retreat.slug ? (
                    <Link
                      to={`/retreats/${talk.retreat.slug}`}
                      className="hover:text-text-secondary"
                    >
                      {talk.retreat.title}
                    </Link>
                  ) : (
                    talk.retreat.title
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-text-primary/5">
              <span className="text-xs text-text-tertiary">
                {formatDuration(talk.duration)}
              </span>
              <button
                onClick={() => handlePlayTalk(talk)}
                className="neumorphic-button rounded-full w-10 h-10 flex items-center justify-center text-text-primary hover:scale-110 transition-transform"
                aria-label="Play"
              >
                <Play size={16} fill="currentColor" className="ml-0.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            onClick={() => goToPage(Math.max(1, pagination.current - 1))}
            disabled={pagination.current === 1}
          >
            ← Previous
          </Button>

          <div className="flex items-center gap-2">
            {[...Array(Math.min(pagination.pages, 5))].map((_, i) => {
              let pageNum;
              if (pagination.pages <= 5) {
                pageNum = i + 1;
              } else if (pagination.current <= 3) {
                pageNum = i + 1;
              } else if (pagination.current >= pagination.pages - 2) {
                pageNum = pagination.pages - 4 + i;
              } else {
                pageNum = pagination.current - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  variant={pagination.current === pageNum ? "pressed" : "ghost"}
                  size="icon"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            onClick={() =>
              goToPage(Math.min(pagination.pages, pagination.current + 1))
            }
            disabled={pagination.current === pagination.pages}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
