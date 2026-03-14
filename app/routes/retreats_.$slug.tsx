import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { eq, like, sql } from "drizzle-orm";
import { motion } from "motion/react";
import { Globe } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { retreats, talks, teachers, centers } from "~/db/schema";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { Tabs } from "~/components/ui/tabs";
import { TeacherCard } from "~/components/teacher-card";
import { cacheHeader } from "pretty-cache-header";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "7days",
    staleWhileRevalidate: "1month",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.retreat) {
    return [{ title: "Retreat Not Found" }];
  }

  const { retreat } = data;
  return [
    { title: `${retreat.title} - Dharma Radio` },
    { name: "description", content: retreat.description },
    { property: "og:title", content: `${retreat.title} - Dharma Radio` },
    { property: "og:description", content: retreat.description },
  ];
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
      ...totalCountField,
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
      params: { page, perPage: 10 },
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
        className="neumorphic-card rounded-2xl p-8 mb-8"
      >
        <h1 className="text-4xl font-semibold text-text-primary mb-4">{retreat.title}</h1>
        {talks.length > 0 && talks[0].centerName && (
          <Link
            to={`/centers/${talks[0].centerSlug}`}
            className="flex items-center space-x-2 text-text-secondary hover:text-blue-600 transition-colors mb-4"
          >
            <Globe size={16} />
            <span>{talks[0].centerName}</span>
          </Link>
        )}
        {retreat.description && (
          <p className="text-text-secondary leading-relaxed">{retreat.description}</p>
        )}
      </motion.div>

      {!showTeacherTabs && teachers.length > 0 && (
        <AnimatedList className="flex flex-wrap gap-3 mb-8">
          {teachers.map((teacher) => (
            <Link
              key={teacher.slug}
              to={`/teachers/${teacher.slug}`}
              className="neumorphic-button flex items-center gap-2 px-4 py-2 rounded-full hover:shadow-lg transition-all"
            >
              {teacher.profileImageUrl && (
                <img
                  src={teacher.profileImageUrl}
                  alt={teacher.name}
                  className="w-7 h-7 rounded-full object-cover"
                  style={{
                    filter: "grayscale(90%) contrast(1.05)",
                  }}
                />
              )}
              <span className="text-sm font-medium text-text-primary">{teacher.name}</span>
              <span className="text-xs text-text-tertiary">
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
