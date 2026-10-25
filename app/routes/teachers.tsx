import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { UserRoundSearch } from "lucide-react";
import { formatCount } from "~/lib/format";
import { TeacherRow } from "~/components/collection-cards";
import { EmptyState, PageHeader, Pagination, SearchField, SortTabs } from "~/components/ui/primitives";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction = () => {
  return [
    { title: "Dharma Teachers - Dharma Radio" },
    {
      name: "description",
      content:
        "Explore dharma talks from Buddhist teachers and meditation instructors from around the world",
    },
    { property: "og:title", content: "Dharma Teachers - Dharma Radio" },
    {
      property: "og:description",
      content:
        "Explore dharma talks from Buddhist teachers and meditation instructors from around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    `teachers:${request.url}`,
    900,
    async () => {
      const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
        field: "talks",
        order: "desc",
      });

      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: teachers.id,
          name: teachers.name,
          slug: teachers.slug,
          description: teachers.description,
          profileImageUrl: teachers.profileImageUrl,
          talksCount: sql<number>`count(distinct ${talks.id})`.as(
            "talks_count",
          ),
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
              talks: { column: sql`talks_count` },
              retreats: { column: sql`retreats_count` },
              centers: { column: sql`centers_count` },
            },
          }),
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 25 },
      });
    },
  );
}

export default function Teachers() {
  const { items, pagination } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Teachers"
        title={q ? <>Teachers matching “{q}”</> : "Voices of the dharma"}
        description={`${formatCount(pagination.total, "teacher")} sharing talks from retreats and sitting groups.`}
      >
        <SearchField placeholder="Find a teacher" defaultValue={q} className="max-w-xl" />
      </PageHeader>

      <div className="sticky top-14 z-20 -mx-5 mb-2 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-12 lg:px-12">
        <SortTabs
          current={params.get("sort") ?? "talks"}
          order={params.get("order") ?? "desc"}
          options={[
            { field: "talks", label: "Most talks" },
            { field: "retreats", label: "Most retreats" },
            { field: "centers", label: "Most centers" },
          ]}
        />
      </div>

      {items.length ? (
        <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {items.map((teacher) => (
            <li key={teacher.id}>
              <TeacherRow teacher={teacher} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState icon={<UserRoundSearch size={20} />} title="No teachers found">
            Check the spelling, or try just a first or last name.
          </EmptyState>
        </div>
      )}

      <Pagination current={pagination.current} pages={pagination.pages} />
    </div>
  );
}
