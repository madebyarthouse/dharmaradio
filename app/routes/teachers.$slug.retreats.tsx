import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, retreats } from "~/db/schema";
import { RetreatCard } from "~/components/retreat-card";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";

type Retreat = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  talksCount: number;
  teachersCount: number;
};

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "title",
    order: "asc",
  });

  if (!slug) {
    throw new Error("Teacher slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  // First get the teacher to get its ID
  const teacher = await database.query.teachers.findFirst({
    where: eq(teachers.slug, slug),
  });

  if (!teacher) {
    throw new Response("Not Found", { status: 404 });
  }

  const retreatsQuery = database
    .select({
      id: retreats.id,
      title: retreats.title,
      slug: retreats.slug,
      description: retreats.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
        "teachers_count",
      ),
      ...totalCountField,
    })
    .from(retreats)
    .innerJoin(talks, eq(talks.retreatId, retreats.id))
    .where(eq(talks.teacherId, teacher.id))
    .groupBy(retreats.id);

  const query = hasSearch
    ? retreatsQuery.$dynamic().where(like(retreats.title, `%${searchQuery}%`))
    : retreatsQuery;

  const finalQuery = query.orderBy(
    withOrdering({
      field: sort.field,
      order: sort.order,
      config: {
        title: { column: retreats.title },
        talks: { column: sql`talks_count` },
      },
    }),
  );

  const paginatedRetreats = await withPagination({
    query: finalQuery.$dynamic(),
    params: { page, perPage: 12 },
  });

  return paginatedRetreats;
}

type LoaderData = {
  items: Retreat[];
  pagination: {
    total: number;
    current: number;
    pages: number;
  };
};

export default function TeacherRetreats() {
  const { items: retreats, pagination } = useLoaderData<LoaderData>();

  const sortOptions = [
    { label: "Title", value: "title" },
    { label: "Talks", value: "talks" },
  ];

  return (
    <FilterableList
      title="Retreats"
      totalItems={pagination.total}
      itemName="retreat"
      sortOptions={sortOptions}
      defaultSort="title"
      currentPage={pagination.current}
      totalPages={pagination.pages}
    >
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {retreats.map((retreat) => (
          <RetreatCard
            key={retreat.id}
            title={retreat.title}
            slug={retreat.slug}
            description={retreat.description}
            talksCount={retreat.talksCount}
            teachersCount={retreat.teachersCount}
          />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
