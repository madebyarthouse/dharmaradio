import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { eq, like } from "drizzle-orm";
import { db } from "~/db/client.server";
import { talks, teachers, retreats, centers } from "~/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { TalkCard } from "~/components/talk-card";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { AnimatedList } from "~/components/ui/animated-list";
import { withOrdering } from "~/utils/with-ordering";
import { getRequestParams } from "~/utils/request-params";
import { cacheHeader } from "pretty-cache-header";

type Center = InferSelectModel<typeof centers>;

type Talk = {
  id: number;
  slug: string;
  title: string;
  audioUrl: string;
  duration: number;
  publicationDate: Date;
  teacherName: string | null;
  teacherSlug: string | null;
  teacherProfileImageUrl: string | null;
  retreatTitle: string | null;
  retreatSlug: string | null;
};

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

  // First get the center to get its ID
  const center = await database.query.centers.findFirst({
    where: eq(centers.slug, slug),
  });

  if (!center) {
    throw new Response("Not Found", { status: 404 });
  }

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

  const paginatedTalks = await withPagination({
    query: finalQuery.$dynamic(),
    params: { page, perPage: 10 },
  });

  return paginatedTalks;
}

type LoaderData = {
  items: Talk[];
  pagination: {
    total: number;
    current: number;
    pages: number;
  };
};

export default function CenterTalks() {
  const { items: talks, pagination } = useLoaderData<LoaderData>();
  const { center } = useOutletContext<{ center: Center }>();

  const sortOptions = [
    { label: "Date", value: "date" },
    { label: "Title", value: "title" },
    { label: "Teacher", value: "teacher" },
  ];

  return (
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
            key={talk.id}
            id={talk.id}
            slug={talk.slug}
            title={talk.title}
            duration={talk.duration}
            audioUrl={talk.audioUrl}
            publicationDate={talk.publicationDate}
            centerName={center.name}
            centerSlug={center.slug}
            teacherName={talk.teacherName}
            teacherSlug={talk.teacherSlug}
            teacherProfileImageUrl={talk.teacherProfileImageUrl}
            retreatTitle={talk.retreatTitle}
            retreatSlug={talk.retreatSlug}
          />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
