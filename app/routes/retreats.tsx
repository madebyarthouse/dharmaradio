import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { RetreatCard } from "~/components/retreat-card";
import { db } from "~/db/client.server";
import { retreats, talks } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { asc, desc, eq, like, sql } from "drizzle-orm";
import { AnimatedList } from "~/components/ui/animated-list";
import { FilterableList } from "~/components/ui/filterable-list";
import { cacheHeader } from "pretty-cache-header";
import type { MetaFunction } from "@remix-run/cloudflare";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

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
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const sortField = url.searchParams.get("sort") || "talks";
  const sortOrder = (url.searchParams.get("order") || "desc") as "asc" | "desc";

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
        "teachers_count",
      ),
      ...totalCountField,
    })
    .from(retreats)
    .leftJoin(talks, eq(talks.retreatId, retreats.id))
    .where(
      searchQuery.length >= 2
        ? like(retreats.title, `%${searchQuery}%`)
        : undefined,
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
            : desc(retreats.title),
    );

  return withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 20 },
  });
}

export default function Retreats() {
  const { items: retreats, pagination } = useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Talks", value: "talks" },
    { label: "Teachers", value: "teachers" },
  ];

  return (
    <FilterableList
      title="Meditation Retreats"
      totalItems={pagination.total}
      itemName="retreat"
      sortOptions={sortOptions}
      defaultSort="talks"
      currentPage={pagination.current}
      totalPages={pagination.pages}
    >
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {retreats.map((retreat) => (
          <RetreatCard key={retreat.slug} {...retreat} />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
