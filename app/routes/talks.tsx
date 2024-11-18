import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { SearchInput } from "~/components/ui/search-input";
import { SortButton } from "~/components/ui/sort-button";
import { Pagination } from "~/components/ui/pagination";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { Suspense } from "react";
import { withPagination } from "~/utils/pagination.server";
import { useSearchWithDebounce, useSort } from "~/utils/search-params";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortField = url.searchParams.get("sort") || "date";
  const sortOrder = (url.searchParams.get("order") || "desc") as "asc" | "desc";

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
      },
      center: {
        name: centers.name,
        slug: centers.slug,
      },
      retreat: {
        title: retreats.title,
        slug: retreats.slug,
      },
    })
    .from(talks)
    .leftJoin(teachers, eq(talks.teacherId, teachers.id))
    .leftJoin(centers, eq(talks.centerId, centers.id))
    .leftJoin(retreats, eq(talks.retreatId, retreats.id))
    .where(
      searchQuery.length >= 2
        ? like(talks.title, `%${searchQuery}%`)
        : undefined
    )
    .orderBy(
      sortField === "title"
        ? sortOrder === "asc"
          ? sql`${talks.title} asc`
          : sql`${talks.title} desc`
        : sortField === "duration"
        ? sortOrder === "asc"
          ? sql`${talks.duration} asc`
          : sql`${talks.duration} desc`
        : sortOrder === "asc"
        ? sql`${talks.publicationDate} asc`
        : sql`${talks.publicationDate} desc`
    );

  return withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 20 },
  });
}

export default function Talks() {
  const { items: talks, pagination } = useLoaderData<typeof loader>();
  const { searchTerm, setSearchTerm, setSearchParams } =
    useSearchWithDebounce();
  const { sort, order, updateSort } = useSort<"date" | "title" | "duration">(
    "date"
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif">Dharma Talks</h1>
        <div className="w-full md:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search talks..."
          />
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <SortButton
          label="Date"
          active={sort === "date"}
          ascending={order === "asc"}
          onClick={() => updateSort("date")}
        />
        <SortButton
          label="Title"
          active={sort === "title"}
          ascending={order === "asc"}
          onClick={() => updateSort("title")}
        />
        <SortButton
          label="Duration"
          active={sort === "duration"}
          ascending={order === "asc"}
          onClick={() => updateSort("duration")}
        />
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <div className="animate-pulse">Loading...</div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {talks.map((talk) => (
            <TalkCard
              key={talk.slug}
              id={talk.id}
              slug={talk.slug}
              title={talk.title}
              duration={talk.duration}
              audioUrl={talk.audioUrl}
              teacherName={talk.teacher?.name ?? null}
              teacherSlug={talk.teacher?.slug ?? null}
              centerName={talk.center?.name ?? null}
              centerSlug={talk.center?.slug ?? null}
              retreatTitle={talk.retreat?.title ?? null}
              retreatSlug={talk.retreat?.slug ?? null}
            />
          ))}
        </div>
      </Suspense>

      <Pagination
        currentPage={pagination.current}
        totalPages={pagination.pages}
        onPageChange={(page) =>
          setSearchParams((prev) => {
            const newParams = new URLSearchParams(prev);
            newParams.set("page", page.toString());
            return newParams;
          })
        }
      />
    </div>
  );
}
