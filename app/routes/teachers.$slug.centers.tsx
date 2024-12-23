import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, centers } from "~/db/schema";
import { CenterCard } from "~/components/center-card";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";

type Center = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  talksCount: number;
  teachersCount: number;
  retreatsCount: number;
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
    field: "name",
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

  const centersQuery = database
    .select({
      id: centers.id,
      name: centers.name,
      slug: centers.slug,
      description: centers.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
        "teachers_count",
      ),
      retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
        "retreats_count",
      ),
      ...totalCountField,
    })
    .from(centers)
    .innerJoin(talks, eq(talks.centerId, centers.id))
    .where(eq(talks.teacherId, teacher.id))
    .groupBy(centers.id);

  const query = hasSearch
    ? centersQuery.$dynamic().where(like(centers.name, `%${searchQuery}%`))
    : centersQuery;

  const finalQuery = query.orderBy(
    withOrdering({
      field: sort.field,
      order: sort.order,
      config: {
        name: { column: centers.name },
        talks: { column: sql`talks_count` },
      },
    }),
  );

  const paginatedCenters = await withPagination({
    query: finalQuery.$dynamic(),
    params: { page, perPage: 12 },
  });

  return paginatedCenters;
}

type LoaderData = {
  items: Center[];
  pagination: {
    total: number;
    current: number;
    pages: number;
  };
};

export default function TeacherCenters() {
  const { items: centers, pagination } = useLoaderData<LoaderData>();

  const sortOptions = [
    { label: "Name", value: "name" },
    { label: "Talks", value: "talks" },
  ];

  return (
    <FilterableList
      title="Centers"
      totalItems={pagination.total}
      itemName="center"
      sortOptions={sortOptions}
      defaultSort="name"
      currentPage={pagination.current}
      totalPages={pagination.pages}
    >
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {centers.map((center) => (
          <CenterCard
            key={center.id}
            name={center.name}
            slug={center.slug}
            description={center.description}
            talksCount={center.talksCount}
            teachersCount={center.teachersCount}
            retreatsCount={center.retreatsCount}
          />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
