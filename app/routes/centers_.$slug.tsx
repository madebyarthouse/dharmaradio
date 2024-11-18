import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { eq, desc } from "drizzle-orm";
import { motion } from "framer-motion";
import { db } from "~/db/client.server";
import { centers, retreats, talks, teachers } from "~/db/schema";
import { TalkCard } from "~/components/talk-card";
import { withPagination } from "~/utils/pagination.server";
import { Pagination } from "~/components/ui/pagination";

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { slug } = params;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");

  if (!slug) {
    throw new Error("Center slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  const center = await database.query.centers.findFirst({
    where: eq(centers.slug, slug),
  });

  if (!center) {
    throw new Response("Not Found", { status: 404 });
  }

  // Get paginated talks for this center
  const query = database
    .select({
      id: talks.id,
      slug: talks.slug,
      title: talks.title,
      audioUrl: talks.audioUrl,
      description: talks.description,
      duration: talks.duration,
      publicationDate: talks.publicationDate,
      teacherName: teachers.name,
      teacherSlug: teachers.slug,
      retreatTitle: retreats.title,
      retreatSlug: retreats.slug,
      centerSlug: centers.slug,
      centerName: centers.name,
    })
    .from(talks)
    .where(eq(talks.centerId, center.id))
    .orderBy(desc(talks.publicationDate))
    .leftJoin(teachers, eq(teachers.id, talks.teacherId))
    .leftJoin(retreats, eq(retreats.id, talks.retreatId))
    .leftJoin(centers, eq(centers.id, talks.centerId));

  const paginatedTalks = await withPagination({
    query: query.$dynamic(),
    params: { page, perPage: 10 },
  });

  return { center, ...paginatedTalks };
}

export default function CenterDetail() {
  const { center, items: talks, pagination } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/60 backdrop-blur rounded-xl p-8 shadow-sm mb-8"
      >
        <h1 className="text-3xl font-serif mb-4">{center.name}</h1>
        <p className="text-sage-600">{center.description}</p>
      </motion.div>

      <div className="mb-8">
        <h2 className="text-xl font-medium mb-4">Recent Talks</h2>
        <div className="flex flex-col gap-4">
          {talks.map((talk) => (
            <TalkCard key={talk.slug} {...talk} />
          ))}
        </div>

        <Pagination
          currentPage={pagination.current}
          totalPages={pagination.pages}
          onPageChange={(page) =>
            setSearchParams((prev) => {
              const newParams = new URLSearchParams(prev);
              newParams.set("page", page.toString());
              return newParams;
            })
          }
        />
      </div>
    </div>
  );
}
