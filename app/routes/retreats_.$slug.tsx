import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { useAudio } from "~/contexts/audio-context";
import { fromFlatRow, toPlayerTalk } from "~/lib/talk";
import { dateParts, formatCount, formatDateRange, formatDuration } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { TeacherTile } from "~/components/collection-cards";
import { Breadcrumbs, ListBar, MetaList, Pagination, Shelf, SortTabs, buttonClass, titleClass } from "~/components/ui/primitives";
import { PlayGlyph } from "~/components/play-glyph";
import { cn } from "~/lib/cn";
import { eq, like, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { retreats, talks, teachers, centers } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
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
    throw new Response("Not Found", { status: 404 });
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
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
    })
    .from(teachers)
    .innerJoin(talks, eq(talks.teacherId, teachers.id))
    .where(eq(talks.retreatId, retreat.id))
    .groupBy(teachers.id);

  // The retreat's dates are its talks' first and last days (stored in seconds).
  const spanQuery = database
    .select({
      firstDate: sql<number>`min(${talks.publicationDate}) * 1000`,
      lastDate: sql<number>`max(${talks.publicationDate}) * 1000`,
      totalDuration: sql<number>`coalesce(sum(${talks.duration}), 0)`,
    })
    .from(talks)
    .where(eq(talks.retreatId, retreat.id));

  const [paginatedTalks, teachersData, [span]] = await Promise.all([
    withPagination({
      query: finalQuery.$dynamic(),
      params: { page, perPage: 50 },
    }),
    teachersQuery,
    spanQuery,
  ]);

  return {
    retreat,
    talks: paginatedTalks.items,
    pagination: paginatedTalks.pagination,
    teachers: teachersData,
    span: span ?? { firstDate: null, lastDate: null, totalDuration: 0 },
  };
}

export default function RetreatDetail() {
  const { retreat, talks: rows, pagination, teachers: teacherList, span } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const audio = useAudio();
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") ?? "desc";

  const talkItems = rows.map((row) =>
    fromFlatRow(row, { retreat: { title: retreat.title, slug: retreat.slug } }),
  );
  const start = dateParts(span.firstDate);
  const range = formatDateRange(span.firstDate, span.lastDate);

  const playFromStart = () => {
    // Retreats are best heard in order, oldest first.
    const ordered = [...talkItems].sort(
      (a, b) => new Date(a.publicationDate ?? 0).getTime() - new Date(b.publicationDate ?? 0).getTime(),
    );
    const [first] = ordered;
    if (first) audio.playNow(toPlayerTalk(first), ordered.map(toPlayerTalk));
  };

  return (
    <div className="animate-rise">
      <header className="relative pb-8 pt-7 md:pt-12">
        <Breadcrumbs
          items={[
            { label: "Listen", to: "/listen" },
            { label: "Retreats", to: "/retreats" },
            { label: retreat.title, to: `/retreats/${retreat.slug}` },
          ]}
        />
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          {/* The ticket stub: a retreat is led by its dates. */}
          {start ? (
            <div className="flex w-28 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-wash py-4 text-accent-ink ring-1 ring-inset ring-line md:w-32">
              <span className="text-xs">{start.month}</span>
              <span className="font-serif text-[3.25rem] leading-none tabular-nums text-ink">{start.day}</span>
              <span className="mt-1 text-xs tabular-nums">{start.year}</span>
            </div>
          ) : null}
          <div className="min-w-0">
            {range ? <p className="mb-2 text-[0.8125rem] tabular-nums text-ink-soft">{range}</p> : null}
            <h1 className={cn(titleClass, "max-w-3xl")}>{retreat.title}</h1>
            <MetaList
              className="mt-4 text-ink-faint"
              items={[
                formatCount(pagination.total, "talk"),
                teacherList.length ? formatCount(teacherList.length, "teacher") : null,
                span.totalDuration ? formatDuration(Number(span.totalDuration)) : null,
              ]}
            />
          </div>
        </div>
        {retreat.description ? (
          <p className="mt-6 max-w-[65ch] whitespace-pre-line text-pretty text-sm leading-relaxed text-ink-soft md:text-[0.9375rem]">
            {retreat.description}
          </p>
        ) : null}
        <button type="button" onClick={playFromStart} className={cn(buttonClass("primary"), "mt-7 pl-2 pr-5")}>
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
            <PlayGlyph playing={false} size={13} />
          </span>
          Play from the beginning
        </button>
      </header>

      {teacherList.length > 1 ? (
        <Shelf title="Teachers" label="Teachers on this retreat">
          {teacherList.map((teacher) => (
            <TeacherTile key={teacher.id} teacher={teacher} />
          ))}
        </Shelf>
      ) : null}

      <section className="py-6 md:py-8">
        <ListBar>
          <h2 className="font-serif text-[1.5rem] leading-tight tracking-[-0.01em]">Talks</h2>
          <SortTabs
            current={sort}
            order={order}
            options={[
              { field: "date", label: "Date", defaultOrder: "asc" },
              { field: "title", label: "Title", defaultOrder: "asc" },
              { field: "teacher", label: "Teacher", defaultOrder: "asc" },
            ]}
          />
        </ListBar>
        <TalkList talks={talkItems} showTeacher={teacherList.length !== 1} />
        <Pagination current={pagination.current} pages={pagination.pages} />
      </section>
    </div>
  );
}
