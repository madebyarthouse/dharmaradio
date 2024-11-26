import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { TeacherCard } from "~/components/teacher-card";
import { db } from "~/db/client.server";
import { talks, teachers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "name",
    order: "asc",
  });

  const database = db(context.cloudflare.env.DB);

  const query = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      description: teachers.description,
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
        "retreats_count",
      ),
      centersCount: sql<number>`count(distinct ${talks.centerId})`.as(
        "centers_count",
      ),
      ...totalCountField,
    })
    .from(teachers)
    .leftJoin(talks, eq(talks.teacherId, teachers.id))
    .where(hasSearch ? like(teachers.name, `%${searchQuery}%`) : undefined)
    .groupBy(teachers.id)
    .orderBy(
      withOrdering({
        field: sort.field,
        order: sort.order,
        config: {
          name: { column: teachers.name },
          talks: { column: sql`talks_count` },
          retreats: { column: sql`retreats_count` },
          centers: { column: sql`centers_count` },
        },
      }),
    );

  return withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 30 },
  });
}

export default function Teachers() {
  const { items: teachers, pagination } = useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Name", value: "name" },
    { label: "Talks", value: "talks" },
    { label: "Retreats", value: "retreats" },
    { label: "Centers", value: "centers" },
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
      <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {teachers.map((teacher) => (
          <TeacherCard
            key={teacher.slug}
            {...teacher}
            talksCount={Number(teacher.talksCount)}
            retreatsCount={Number(teacher.retreatsCount)}
            centersCount={Number(teacher.centersCount)}
          />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
