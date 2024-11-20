import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { eq, like, sql } from "drizzle-orm";
import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { retreats, talks, teachers, centers } from "~/db/schema";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { Tabs } from "~/components/ui/tabs";
import { TeacherCard } from "~/components/teacher-card";
import { cacheHeader } from "pretty-cache-header";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "1hour",
    sMaxage: "3hours",
    staleWhileRevalidate: "1day",
  }),
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

  if (!slug) {
    throw new Error("Retreat slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const retreat = await database.query.retreats.findFirst({
    where: eq(retreats.slug, slug),
  });

  if (!retreat) {
    throw new Error("Retreat not found");
  }

  const baseQuery = database
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      duration: talks.duration,
      audioUrl: talks.audioUrl,
      publicationDate: talks.publicationDate,
      teacherName: teachers.name,
      teacherSlug: teachers.slug,
      teacherProfileImageUrl: teachers.profileImageUrl,
      centerName: centers.name,
      centerSlug: centers.slug,
    })
    .from(talks)
    .leftJoin(teachers, eq(teachers.id, talks.teacherId))
    .leftJoin(centers, eq(centers.id, talks.centerId))
    .where(eq(talks.retreatId, retreat.id));

  const query = hasSearch
    ? baseQuery.$dynamic().where(like(talks.title, `%${searchQuery}%`))
    : baseQuery;

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

  const teachersQuery = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      description: teachers.description,
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      retreatsCount:
        sql<number>`count(distinct case when ${retreats.id} is not null then ${retreats.id} end)`.as(
          "retreats_count",
        ),
      centersCount:
        sql<number>`count(distinct case when ${centers.id} is not null then ${centers.id} end)`.as(
          "centers_count",
        ),
    })
    .from(teachers)
    .innerJoin(talks, eq(talks.teacherId, teachers.id))
    .leftJoin(retreats, eq(talks.retreatId, retreats.id))
    .leftJoin(centers, eq(talks.centerId, centers.id))
    .where(eq(talks.retreatId, retreat.id))
    .groupBy(teachers.id);

  const [paginatedTalks, teachersData] = await Promise.all([
    withPagination({
      query: finalQuery.$dynamic(),
      params: { page, perPage: 20 },
    }),
    teachersQuery,
  ]);

  return {
    retreat,
    talks: paginatedTalks.items,
    pagination: paginatedTalks.pagination,
    teachers: teachersData,
  };
}

export default function RetreatDetail() {
  const { retreat, talks, pagination, teachers } =
    useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Date", value: "date" },
    { label: "Title", value: "title" },
    { label: "Teacher", value: "teacher" },
  ];

  const showTeacherTabs = teachers.length > 3;

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative rounded-xl overflow-hidden mb-8 shadow-sm"
      >
        <h1 className="text-4xl font-serif  mb-2">{retreat.title}</h1>
        <Link
          to={`/centers/${talks[0].centerSlug}`}
          className="flex items-center space-x-4"
        >
          {talks.length > 0 && (
            <div className="flex items-center space-x-2">
              <Globe size={16} />
              <span>{talks[0].centerName}</span>
            </div>
          )}
        </Link>
      </motion.div>

      {retreat.description && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="col-span-2">
            <h2 className="text-xl font-medium mb-4">About this Retreat</h2>
            <p className="text-green-800 mb-6">{retreat.description}</p>
          </div>
        </div>
      )}

      {!showTeacherTabs && teachers.length > 0 && (
        <AnimatedList className="flex flex-wrap gap-4 mb-8">
          {teachers.map((teacher) => (
            <Link
              key={teacher.slug}
              to={`/teachers/${teacher.slug}`}
              className="flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur rounded-full shadow-sm hover:shadow-md transition-all"
            >
              {teacher.profileImageUrl && (
                <img
                  src={teacher.profileImageUrl}
                  alt={teacher.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <span className="text-sm font-medium">{teacher.name}</span>
              <span className="text-xs text-green-600">
                {teacher.talksCount} talks
              </span>
            </Link>
          ))}
        </AnimatedList>
      )}

      {showTeacherTabs ? (
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
                        teacherProfileImageUrl={talk.teacherProfileImageUrl}
                        centerName={talk.centerName}
                        centerSlug={talk.centerSlug}
                        retreatTitle={retreat.title}
                        retreatSlug={retreat.slug}
                        teacherName={talk.teacherName}
                        teacherSlug={talk.teacherSlug}
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
                        retreatsCount={Number(teacher.retreatsCount)}
                        centersCount={Number(teacher.centersCount)}
                      />
                    ))}
                  </AnimatedList>
                </FilterableList>
              ),
            },
          ]}
        />
      ) : (
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
                teacherProfileImageUrl={talk.teacherProfileImageUrl}
                centerName={talk.centerName}
                centerSlug={talk.centerSlug}
                retreatTitle={retreat.title}
                retreatSlug={retreat.slug}
                teacherName={talk.teacherName}
                teacherSlug={talk.teacherSlug}
              />
            ))}
          </AnimatedList>
        </FilterableList>
      )}
    </div>
  );
}
