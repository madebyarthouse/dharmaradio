import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, sql } from "drizzle-orm";
import { motion } from "framer-motion";
import { Globe, Heart, ExternalLink } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { teachers, talks, centers, retreats } from "~/db/schema";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { Tabs } from "~/components/ui/tabs";
import { CenterCard } from "~/components/center-card";
import { RetreatCard } from "~/components/retreat-card";
import { cacheHeader } from "pretty-cache-header";
import type { MetaFunction } from "@remix-run/cloudflare";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "7days",
    staleWhileRevalidate: "1month",
  }),
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.teacher) {
    return [{ title: "Teacher Not Found" }];
  }

  const { teacher } = data;
  return [
    { title: `${teacher.name} - Dharma Teacher - Dharma Radio` },
    { name: "description", content: teacher.description },
    {
      property: "og:title",
      content: `${teacher.name} - Dharma Teacher - Dharma Radio`,
    },
    { property: "og:description", content: teacher.description },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;
  const { page } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

  if (!slug) {
    throw new Error("Teacher slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const teacherQuery = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      description: teachers.description,
      profileImageUrl: teachers.profileImageUrl,
      websiteUrl: teachers.websiteUrl,
      donationUrl: teachers.donationUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
        "retreats_count",
      ),
      centersCount: sql<number>`count(distinct ${talks.centerId})`.as(
        "centers_count",
      ),
    })
    .from(teachers)
    .leftJoin(talks, eq(talks.teacherId, teachers.id))
    .where(eq(teachers.slug, slug))
    .groupBy(teachers.id);

  const [teacher] = await teacherQuery.execute();

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  const talksQuery = database
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      duration: talks.duration,
      audioUrl: talks.audioUrl,
      publicationDate: talks.publicationDate,
      centerName: centers.name,
      centerSlug: centers.slug,
      retreatTitle: retreats.title,
      retreatSlug: retreats.slug,
      ...totalCountField,
    })
    .from(talks)
    .leftJoin(centers, eq(talks.centerId, centers.id))
    .leftJoin(retreats, eq(talks.retreatId, retreats.id))
    .where(eq(talks.teacherId, teacher.id));

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
    .where(eq(talks.teacherId, teacher.id))
    .groupBy(retreats.id);

  const centersQuery = database
    .select({
      id: centers.id,
      name: centers.name,
      slug: centers.slug,
      description: centers.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
    })
    .from(centers)
    .innerJoin(talks, eq(talks.centerId, centers.id))
    .where(eq(talks.teacherId, teacher.id))
    .groupBy(centers.id);

  const [paginatedTalks, retreatsData, centersData] = await Promise.all([
    withPagination({
      query: talksQuery.$dynamic(),
      params: { page, perPage: 10 },
    }),
    retreatsQuery,
    centersQuery,
  ]);

  return {
    teacher,
    ...paginatedTalks,
    retreats: retreatsData,
    centers: centersData,
  };
}

export default function TeacherDetail() {
  const {
    teacher,
    items: talks,
    pagination,
    retreats,
    centers,
  } = useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Date", value: "date" },
    { label: "Title", value: "title" },
    { label: "Duration", value: "duration" },
  ];

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/60 backdrop-blur rounded-xl p-8 shadow-sm mb-8"
      >
        <div className="flex flex-col md:flex-row md:items-start md:space-x-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-6 md:mb-0"
          >
            <img
              src={teacher.profileImageUrl || ""}
              alt={teacher.name}
              className="w-32 h-32 rounded-full object-cover aspect-square ring-4 ring-green-100"
            />
          </motion.div>
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-serif mb-2 text-center md:text-left"
            >
              {teacher.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-green-800 mb-4"
            >
              {teacher.description}
            </motion.p>
            <div className="flex justify-center md:justify-start space-x-4">
              {teacher.websiteUrl && (
                <a
                  href={teacher.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-green-800 hover:text-green-900 transition-colors"
                >
                  <Globe size={16} />
                  <span>Website</span>
                  <ExternalLink size={12} />
                </a>
              )}
              {teacher.donationUrl && (
                <a
                  href={teacher.donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-green-800 hover:text-rose-500 transition-colors"
                >
                  <Heart size={16} />
                  <span>Support</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
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
                      teacherName={teacher.name}
                      teacherSlug={teacher.slug}
                      teacherProfileImageUrl={teacher.profileImageUrl}
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
                      teachersCount={teacher.talksCount}
                    />
                  ))}
                </AnimatedList>
              </FilterableList>
            ),
          },
          {
            value: "centers",
            label: "Centers",
            count: centers.length,
            content: (
              <FilterableList
                title="Centers"
                totalItems={centers.length}
                itemName="center"
                currentPage={1}
                totalPages={1}
              >
                <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {centers.map((center) => (
                    <CenterCard
                      key={center.slug}
                      {...center}
                      teachersCount={teacher.talksCount}
                      retreatsCount={teacher.retreatsCount}
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
