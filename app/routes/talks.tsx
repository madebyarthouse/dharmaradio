import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, like } from "drizzle-orm";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { totalCountField, withPagination } from "~/utils/pagination.server";
import { FilterableList } from "~/components/ui/filterable-list";
import { getRequestParams } from "~/utils/request-params";
import { withOrdering } from "~/utils/with-ordering";
import { AnimatedList } from "~/components/ui/animated-list";
import { cacheHeader } from "pretty-cache-header";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
    field: "date",
    order: "desc",
  });

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
    .where(hasSearch ? like(talks.title, `%${searchQuery}%`) : undefined)
    .orderBy(
      withOrdering({
        field: sort.field,
        order: sort.order,
        config: {
          title: { column: talks.title },
          duration: { column: talks.duration },
          date: { column: talks.publicationDate },
        },
      }),
    );

  return withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 20 },
  });
}

export default function Talks() {
  const { items: talks, pagination } = useLoaderData<typeof loader>();

  const sortOptions = [
    { label: "Date", value: "date" },
    { label: "Title", value: "title" },
    { label: "Duration", value: "duration" },
  ];

  return (
    <FilterableList
      title="Dharma Talks"
      totalItems={pagination.total}
      itemName="talk"
      sortOptions={sortOptions}
      defaultSort="date"
      currentPage={pagination.current}
      totalPages={pagination.pages}
    >
      <AnimatedList className="flex flex-col gap-4 mb-8">
        {talks.map((talk) => (
          <TalkCard
            {...talk}
            key={talk.slug}
            teacherName={talk.teacher?.name ?? null}
            teacherSlug={talk.teacher?.slug ?? null}
            teacherProfileImageUrl={talk.teacher?.profileImageUrl ?? null}
            centerName={talk.center?.name ?? null}
            centerSlug={talk.center?.slug ?? null}
            retreatTitle={talk.retreat?.title ?? null}
            retreatSlug={talk.retreat?.slug ?? null}
          />
        ))}
      </AnimatedList>
    </FilterableList>
  );
}
