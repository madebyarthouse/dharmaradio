import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { RetreatCard } from "~/components/retreat-card";
import { SearchInput } from "~/components/ui/search-input";
import { SortButton } from "~/components/ui/sort-button";
import { Pagination } from "~/components/ui/pagination";
import { db } from "~/db/client.server";
import { retreats, talks } from "~/db/schema";
import { Suspense } from "react";
import { withPagination } from "~/utils/pagination.server";
import { useSearchWithDebounce, useSort } from "~/utils/search-params";
import { asc, desc, eq, like, sql } from "drizzle-orm";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortField = url.searchParams.get("sort") || "title";
  const sortOrder = (url.searchParams.get("order") || "asc") as "asc" | "desc";

  const database = db(context.cloudflare.env.DB);

  // Build base query with relations
  const query = database
    .select({
      id: retreats.id,
      slug: retreats.slug,
      title: retreats.title,
      description: retreats.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
        "teachers_count"
      ),
    })
    .from(retreats)
    .leftJoin(talks, eq(talks.retreatId, retreats.id))
    .where(
      searchQuery.length >= 2
        ? like(retreats.title, `%${searchQuery}%`)
        : undefined
    )
    .groupBy(retreats.id)
    .orderBy(
      sortField === "talks"
        ? sortOrder === "asc"
          ? asc(sql`talks_count`)
          : desc(sql`talks_count`)
        : sortField === "teachers"
        ? sortOrder === "asc"
          ? asc(sql`teachers_count`)
          : desc(sql`teachers_count`)
        : sortOrder === "asc"
        ? asc(retreats.title)
        : desc(retreats.title)
    );

  return withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 20 },
  });
}

export default function Retreats() {
  const { items: retreats, pagination } = useLoaderData<typeof loader>();
  const { searchTerm, setSearchTerm, setSearchParams } =
    useSearchWithDebounce();
  const { sort, order, updateSort } = useSort<"title" | "talks" | "teachers">(
    "title"
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif">Meditation Retreats</h1>
        <div className="w-full md:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search retreats..."
          />
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <SortButton
          label="Title"
          active={sort === "title"}
          ascending={order === "asc"}
          onClick={() => updateSort("title")}
        />
        <SortButton
          label="Talks"
          active={sort === "talks"}
          ascending={order === "asc"}
          onClick={() => updateSort("talks")}
        />
        <SortButton
          label="Teachers"
          active={sort === "teachers"}
          ascending={order === "asc"}
          onClick={() => updateSort("teachers")}
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
          {retreats.map((retreat) => (
            <RetreatCard key={retreat.slug} {...retreat} />
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
