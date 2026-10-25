import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { useAudio } from "~/contexts/audio-context";
import { fromFlatRow, toPlayerTalk } from "~/lib/talk";
import { formatCount, formatDate, formatDuration } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { TeacherTile } from "~/components/collection-cards";
import { Pagination, Section, SortTabs, buttonClass } from "~/components/ui/primitives";
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

  const [paginatedTalks, teachersData] = await Promise.all([
    withPagination({
      query: finalQuery.$dynamic(),
      params: { page, perPage: 50 },
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
  const { retreat, talks: rows, pagination, teachers: teacherList } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const audio = useAudio();
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") ?? "desc";

  const talkItems = rows.map((row) =>
    fromFlatRow(row, { retreat: { title: retreat.title, slug: retreat.slug } }),
  );
  const totalDuration = talkItems.reduce((sum, t) => sum + t.duration, 0);
  const dates = talkItems
    .map((t) => (t.publicationDate ? new Date(t.publicationDate).getTime() : NaN))
    .filter(Number.isFinite);

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
      <header className="relative -mx-5 overflow-hidden px-5 pb-8 pt-10 sm:-mx-8 sm:px-8 md:pt-16 lg:-mx-12 lg:px-12">
        <div aria-hidden className="dusk-glow absolute inset-0" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">Retreat</p>
          <h1 className="mt-3 max-w-3xl text-balance font-serif text-4xl italic leading-[1.05] tracking-tight md:text-6xl">
            {retreat.title}
          </h1>
          <p className="mt-4 text-sm text-ink-soft">
            {formatCount(pagination.total, "talk")}
            {teacherList.length ? ` · ${formatCount(teacherList.length, "teacher")}` : ""}
            {dates.length && pagination.pages <= 1
              ? ` · ${formatDate(Math.min(...dates))}${Math.max(...dates) - Math.min(...dates) > 86400000 ? ` – ${formatDate(Math.max(...dates))}` : ""}`
              : ""}
            {pagination.pages <= 1 && totalDuration ? ` · ${formatDuration(totalDuration)}` : ""}
          </p>
          {retreat.description ? (
            <p className="mt-6 max-w-2xl whitespace-pre-line text-pretty font-serif text-lg leading-relaxed text-ink-soft">
              {retreat.description}
            </p>
          ) : null}
          <button type="button" onClick={playFromStart} className={cn(buttonClass("primary"), "mt-7 pl-2 pr-5")}>
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
              <PlayGlyph playing={false} size={13} />
            </span>
            Play from the beginning
          </button>
        </div>
      </header>

      {teacherList.length > 1 ? (
        <Section title="Teachers">
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-none sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
            {teacherList.map((teacher) => (
              <TeacherTile key={teacher.id} teacher={teacher} />
            ))}
          </div>
        </Section>
      ) : null}

      <section className="py-6 md:py-8">
        <div className="sticky top-14 z-20 -mx-5 mb-2 flex items-center justify-between gap-4 border-b border-line bg-paper/90 px-5 py-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-12 lg:px-12">
          <h2 className="font-serif text-2xl tracking-tight">Talks</h2>
          <SortTabs
            current={sort}
            order={order}
            options={[
              { field: "date", label: "Date", defaultOrder: "asc" },
              { field: "title", label: "Title", defaultOrder: "asc" },
              { field: "teacher", label: "Teacher", defaultOrder: "asc" },
            ]}
          />
        </div>
        <TalkList talks={talkItems} showTeacher={teacherList.length !== 1} />
        <Pagination current={pagination.current} pages={pagination.pages} />
      </section>
    </div>
  );
}
