import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { motion } from "framer-motion";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { TalkCard } from "~/components/talk-card";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { Tabs } from "~/components/ui/tabs";
import { TeacherCard } from "~/components/teacher-card";
import { RetreatCard } from "~/components/retreat-card";
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

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

  if (!slug) {
    throw new Error("Center slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const center = await database.query.centers.findFirst({
    where: eq(centers.slug, slug),
  });

  if (!center) {
    throw new Response("Not Found", { status: 404 });
  }

  // Get talks
  const talksQuery = database
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      audioUrl: talks.audioUrl,
      duration: talks.duration,
      publicationDate: talks.publicationDate,
      teacherName: teachers.name,
      teacherSlug: teachers.slug,
      teacherProfileImageUrl: teachers.profileImageUrl,
      retreatTitle: retreats.title,
      retreatSlug: retreats.slug,
      ...totalCountField,
    })
    .from(talks)
    .where(eq(talks.centerId, center.id))
    .leftJoin(teachers, eq(teachers.id, talks.teacherId))
    .leftJoin(retreats, eq(retreats.id, talks.retreatId));

  const query = hasSearch
    ? talksQuery.$dynamic().where(like(talks.title, `%${searchQuery}%`))
    : talksQuery;

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

  // Get teachers
  const teachersQuery = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      description: teachers.description,
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
    })
    .from(teachers)
    .innerJoin(talks, eq(talks.teacherId, teachers.id))
    .where(eq(talks.centerId, center.id))
    .groupBy(teachers.id);

  // Get retreats
  const retreatsQuery = database
    .select({
      id: retreats.id,
      title: retreats.title,
      slug: retreats.slug,
      description: retreats.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
    })
    .from(retreats)
    .innerJoin(talks, eq(talks.retreatId, retreats.id))
    .where(eq(talks.centerId, center.id))
    .groupBy(retreats.id);

  const [paginatedTalks, teachersData, retreatsData] = await Promise.all([
    withPagination({
      query: finalQuery.$dynamic(),
      params: { page, perPage: 20 },
    }),
    teachersQuery,
    retreatsQuery,
  ]);

  return {
    center,
    ...paginatedTalks,
    teachers: teachersData,
    retreats: retreatsData,
  };
}

export default function CenterDetail() {
  const {
    center,
    items: talks,
    pagination,
    teachers,
    retreats,
  } = useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Date", value: "date" },
    { label: "Title", value: "title" },
    { label: "Teacher", value: "teacher" },
  ];

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className=" mb-8"
      >
        <h1 className="text-3xl font-serif mb-4">{center.name}</h1>
        <p className="text-green-800">{center.description}</p>
      </motion.div>

      <Tabs
        defaultValue="talks"
        tabs={[
          {
            value: "talks",
            label: "Talks",
            count: pagination.total,
            content: (
              <FilterableList
                title="Talks"
                totalItems={pagination.total}
                itemName="talk"
                sortOptions={sortOptions}
                defaultSort="date"
                currentPage={pagination.current}
                totalPages={pagination.pages}
              >
                <AnimatedList className="flex flex-col gap-4">
                  {talks.map((talk) => (
                    <TalkCard
                      key={talk.slug}
                      {...talk}
                      centerName={center.name}
                      centerSlug={center.slug}
                      teacherName={talk.teacherName}
                      teacherSlug={talk.teacherSlug}
                      teacherProfileImageUrl={talk.teacherProfileImageUrl}
                    />
                  ))}
                </AnimatedList>
              </FilterableList>
            ),
          },
          {
            value: "teachers",
            label: "Teachers",
            count: teachers.length,
            content: (
              <FilterableList
                title="Teachers"
                totalItems={teachers.length}
                itemName="teacher"
                currentPage={1}
                totalPages={1}
              >
                <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teachers.map((teacher) => (
                    <TeacherCard
                      key={teacher.slug}
                      {...teacher}
                      talksCount={Number(teacher.talksCount)}
                      retreatsCount={0}
                      centersCount={0}
                    />
                  ))}
                </AnimatedList>
              </FilterableList>
            ),
          },
          {
            value: "retreats",
            label: "Retreats",
            count: retreats.length,
            content: (
              <FilterableList
                title="Retreats"
                totalItems={retreats.length}
                itemName="retreat"
                currentPage={1}
                totalPages={1}
              >
                <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {retreats.map((retreat) => (
                    <RetreatCard
                      key={retreat.slug}
                      {...retreat}
                      talksCount={Number(retreat.talksCount)}
                      teachersCount={0}
                    />
                  ))}
                </AnimatedList>
              </FilterableList>
            ),
          },
        ]}
      />
    </div>
  );
}
