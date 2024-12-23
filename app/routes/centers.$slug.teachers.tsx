import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, centers } from "~/db/schema";
import { TeacherCard } from "~/components/teacher-card";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";

type Teacher = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  profileImageUrl: string | null;
  talksCount: number;
  retreatsCount: number;
  centersCount: number;
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
    throw new Error("Center slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  // First get the center to get its ID
  const center = await database.query.centers.findFirst({
    where: eq(centers.slug, slug),
  });

  if (!center) {
    throw new Response("Not Found", { status: 404 });
  }

  const teachersQuery = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      description: teachers.description,
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      retreatsCount:
        sql<number>`count(distinct case when ${talks.retreatId} is not null then ${talks.retreatId} end)`.as(
          "retreats_count",
        ),
      centersCount:
        sql<number>`count(distinct case when ${talks.centerId} is not null then ${talks.centerId} end)`.as(
          "centers_count",
        ),
      ...totalCountField,
    })
    .from(teachers)
    .innerJoin(talks, eq(talks.teacherId, teachers.id))
    .where(eq(talks.centerId, center.id))
    .groupBy(teachers.id);

  const query = hasSearch
    ? teachersQuery.$dynamic().where(like(teachers.name, `%${searchQuery}%`))
    : teachersQuery;

  const finalQuery = query.orderBy(
    withOrdering({
      field: sort.field,
      order: sort.order,
      config: {
        name: { column: teachers.name },
        talks: { column: sql`talks_count` },
      },
    }),
  );

  const paginatedTeachers = await withPagination({
    query: finalQuery.$dynamic(),
    params: { page, perPage: 12 },
  });

  return paginatedTeachers;
}

type LoaderData = {
  items: Teacher[];
  pagination: {
    total: number;
    current: number;
    pages: number;
  };
};

export default function CenterTeachers() {
  const { items: teachers, pagination } = useLoaderData<LoaderData>();

  const sortOptions = [
    { label: "Name", value: "name" },
    { label: "Talks", value: "talks" },
  ];

  return (
    <FilterableList
      title="Teachers"
      totalItems={pagination.total}
      itemName="teacher"
      sortOptions={sortOptions}
      defaultSort="name"
      currentPage={pagination.current}
      totalPages={pagination.pages}
    >
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers.map((teacher) => (
          <TeacherCard
            key={teacher.id}
            name={teacher.name}
            slug={teacher.slug}
            description={teacher.description}
            profileImageUrl={teacher.profileImageUrl}
            talksCount={teacher.talksCount}
            retreatsCount={teacher.retreatsCount}
            centersCount={teacher.centersCount}
          />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
