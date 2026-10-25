import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { eq, like, or } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";
import { fromNestedRow } from "~/lib/talk";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { EmptyState, PageHeader, Pagination, SearchField, SortTabs } from "~/components/ui/primitives";
import { SearchX } from "lucide-react";

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
    { title: "Talks — Dharma Radio" },
    {
      name: "description",
      content:
        "Listen to thousands of dharma talks from teachers around the world",
    },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

  return withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    [
      "talks",
      `page=${page}`,
      `q=${searchQuery}`,
      `sort=${sort.field}`,
      `order=${sort.order}`,
    ].join(":"),
    900,
    async () => {
      const database = db(context.cloudflare.env.DB);

      const query = database
        .select({
          id: talks.id,
          title: talks.title,
          slug: talks.slug,
          duration: talks.duration,
          audioUrl: talks.audioUrl,
          publicationDate: talks.publicationDate,
          teacher: {
            name: teachers.name,
            slug: teachers.slug,
            profileImageUrl: teachers.profileImageUrl,
          },
          center: {
            name: centers.name,
            slug: centers.slug,
          },
          retreat: {
            title: retreats.title,
            slug: retreats.slug,
          },
          ...totalCountField,
        })
        .from(talks)
        .leftJoin(teachers, eq(talks.teacherId, teachers.id))
        .leftJoin(centers, eq(talks.centerId, centers.id))
        .leftJoin(retreats, eq(talks.retreatId, retreats.id))
        .where(
          hasSearch
            ? or(
                like(talks.title, `%${searchQuery}%`),
                like(teachers.name, `%${searchQuery}%`)
              )
            : undefined
        )
        .orderBy(
          withOrdering({
            field: sort.field,
            order: sort.order,
            config: {
              title: { column: talks.title },
              duration: { column: talks.duration },
              date: { column: talks.publicationDate },
            },
          })
        );

      return withPagination({
        query: query.$dynamic(),
        params: { page, perPage: 25 },
      });
    }
  );
}

export default function Talks() {
  const { items, pagination } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") ?? "desc";
  const talkItems = items.map(fromNestedRow);

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Library of talks"
        title={q ? <>Results for “{q}”</> : "Talks"}
        description={
          q
            ? `${formatCount(pagination.total, "talk")} by title or teacher`
            : `${formatCount(pagination.total, "recording")}, newest first.`
        }
      >
        <SearchField placeholder="Search by title or teacher" defaultValue={q} className="max-w-xl" />
      </PageHeader>

      <div className="sticky top-14 z-20 -mx-5 mb-2 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-12 lg:px-12">
        <SortTabs
          current={sort}
          order={order}
          options={[
            { field: "date", label: "Newest" },
            { field: "title", label: "Title", defaultOrder: "asc" },
            { field: "duration", label: "Length" },
          ]}
        />
      </div>

      {talkItems.length ? (
        <TalkList talks={talkItems} />
      ) : (
        <div className="mt-6">
          <EmptyState icon={<SearchX size={20} />} title="No talks found">
            Try a teacher’s name or a single word from the title.
          </EmptyState>
        </div>
      )}

      <Pagination current={pagination.current} pages={pagination.pages} />
    </div>
  );
}
