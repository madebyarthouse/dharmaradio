import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { cacheHeader } from "pretty-cache-header";
import { withCachedJson } from "~/lib/cache.server";
import { GUIDED_LENGTHS, type GuidedLengthKey } from "~/lib/guided";
import { guidedLengthCondition, guidedTitleCondition } from "~/lib/guided.server";
import { fromNestedRow } from "~/lib/talk";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { EmptyState, FilterChip, PageHeader, Pagination, SearchField, SortTabs } from "~/components/ui/primitives";
import { SearchX } from "lucide-react";

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export const headers = () => cacheHeaders;

export const meta: MetaFunction = ({ location }) => {
  const guided = new URLSearchParams(location.search).get("kind") === "guided";
  return [
    { title: guided ? "Guided meditations, Dharma Radio" : "Talks, Dharma Radio" },
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

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") === "guided" ? "guided" : null;
  const length = GUIDED_LENGTHS.find((item) => item.key === params.get("length"))?.key ?? null;
  const result = await withCachedJson(
    context.cloudflare.env.DB_QUERY_CACHE,
    [
      "talks",
      `page=${page}`,
      `q=${searchQuery}`,
      `sort=${sort.field}`,
      `order=${sort.order}`,
      `kind=${kind ?? "all"}`,
      `length=${length ?? "all"}`,
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
        .where(and(
          kind === "guided" ? guidedTitleCondition : undefined,
          length ? guidedLengthCondition(length) : undefined,
          hasSearch
            ? or(
                like(talks.title, `%${searchQuery}%`),
                like(teachers.name, `%${searchQuery}%`)
              )
            : undefined
        ))
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
  return { ...result, kind, length };
}

/** The narrowing in the URL, shown as chips; each one removes itself. */
function Filters({ kind, length }: { kind: string | null; length: GuidedLengthKey | null }) {
  const [params] = useSearchParams();
  const without = (...keys: string[]) => {
    const next = new URLSearchParams(params);
    for (const key of [...keys, "page"]) next.delete(key);
    const qs = next.toString();
    return qs ? `?${qs}` : "/talks";
  };
  const withLength = (key: GuidedLengthKey) => {
    const next = new URLSearchParams(params);
    next.set("kind", "guided");
    next.set("length", key);
    next.delete("page");
    return `?${next}`;
  };
  return (
    <div className="-mx-1 mt-5 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
      {kind ? (
        <FilterChip to={without("kind", "length")} label="Remove the guided filter">
          Guided
        </FilterChip>
      ) : null}
      {kind ? <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-line-strong" /> : null}
      <nav aria-label="Length" className="flex shrink-0 gap-1">
        {GUIDED_LENGTHS.map((item) => {
          const label = item.key === "60" ? "An hour or more" : `About ${item.key} min`;
          return item.key === length ? (
            <FilterChip key={item.key} to={without("length")} label={`Remove the length filter, ${label}`}>
              {label}
            </FilterChip>
          ) : (
            <Link
              key={item.key}
              to={withLength(item.key)}
              preventScrollReset
              className="press inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[0.8125rem] tabular-nums text-ink-soft hover:bg-paper-sunken hover:text-ink"
            >
              {item.key === "60" ? "An hour or more" : `${item.key} min`}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function Talks() {
  const { items, pagination, kind, length } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") ?? "desc";
  const talkItems = items.map(fromNestedRow);

  return (
    <div className="animate-rise">
      <PageHeader
        breadcrumbs={[{ label: "Listen", to: "/listen" }, { label: kind === "guided" ? "Guided meditations" : "Talks", to: kind === "guided" ? "/talks?kind=guided" : "/talks" }]}
        title={q ? <>Results for “{q}”</> : kind === "guided" ? "Guided meditations" : "Talks"}
        description={
          q
            ? `${formatCount(pagination.total, kind ? "guided meditation" : "talk")} by title or teacher.`
            : kind === "guided"
              ? `${formatCount(pagination.total, "recording")} with “guided” in the title, newest first.`
              : `${formatCount(pagination.total, "recording")}, newest first.`
        }
      >
        <SearchField
          placeholder={kind ? "Search guided meditations" : "Search by title or teacher"}
          defaultValue={q}
          className="max-w-xl"
        />
        {kind || length ? <Filters kind={kind} length={length} /> : null}
      </PageHeader>

      <div className="sticky top-[var(--bar-h)] z-20 -mx-5 mb-2 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
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
