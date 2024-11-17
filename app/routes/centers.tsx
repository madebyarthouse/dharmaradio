import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, desc, asc, sql } from "drizzle-orm";
import { SearchInput } from "~/components/ui/search-input";
import { SortButton } from "~/components/ui/sort-button";
import { Pagination } from "~/components/ui/pagination";
import { CenterCard } from "~/components/center-card";
import { db } from "~/db/client.server";
import { centers, talks } from "~/db/schema";
import { Suspense } from "react";
import { withPagination } from "~/utils/pagination.server";
import { useSearchWithDebounce, useSort } from "~/utils/search-params";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortField = url.searchParams.get("sort") || "name";
  const sortOrder = (url.searchParams.get("order") || "asc") as "asc" | "desc";

  const database = db(context.cloudflare.env.DB);

  const query = database
    .select({
      id: centers.id,
      name: centers.name,
      slug: centers.slug,
      description: centers.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
        "teachers_count"
      ),
      retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
        "retreats_count"
      ),
    })
    .from(centers)
    .leftJoin(talks, eq(talks.centerId, centers.id))
    .where(
      searchQuery.length >= 2
        ? like(centers.name, `%${searchQuery}%`)
        : undefined
    )
    .groupBy(centers.id)
    .orderBy(
      sortField === "talks"
        ? sortOrder === "asc"
          ? asc(sql`talks_count`)
          : desc(sql`talks_count`)
        : sortField === "teachers"
        ? sortOrder === "asc"
          ? asc(sql`teachers_count`)
          : desc(sql`teachers_count`)
        : sortField === "retreats"
        ? sortOrder === "asc"
          ? asc(sql`retreats_count`)
          : desc(sql`retreats_count`)
        : sortOrder === "asc"
        ? asc(centers.name)
        : desc(centers.name)
    );

  return withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 20 },
  });
}

export default function Centers() {
  const { items: centers, pagination } = useLoaderData<typeof loader>();
  const { searchTerm, setSearchTerm, setSearchParams } =
    useSearchWithDebounce();
  const { sort, order, updateSort } = useSort<
    "name" | "talks" | "teachers" | "retreats"
  >("name");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif">Meditation Centers</h1>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search centers..."
        />
      </div>

      <div className="mb-4 flex gap-2">
        <SortButton
          label="Name"
          active={sort === "name"}
          ascending={order === "asc"}
          onClick={() => updateSort("name")}
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
        <SortButton
          label="Retreats"
          active={sort === "retreats"}
          ascending={order === "asc"}
          onClick={() => updateSort("retreats")}
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
          {centers.map((center) => (
            <CenterCard key={center.slug} {...center} />
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
