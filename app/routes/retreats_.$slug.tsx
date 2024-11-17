import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { retreats } from "~/db/schema";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Retreat slug is required");
  }

  const retreat = await db(context.cloudflare.env.DB).query.retreats.findFirst({
    where: eq(retreats.slug, slug),
    with: {
      talks: {
        with: {
          teacher: {
            columns: {
              name: true,
              slug: true,
            },
          },
          center: {
            columns: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!retreat) {
    throw new Error("Retreat not found");
  }

  return { retreat };
}

export default function RetreatDetail() {
  const { retreat } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative rounded-xl overflow-hidden mb-8 shadow-sm"
      >
        <div className="h-64 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-8 right-8">
            <h1 className="text-4xl font-serif text-white mb-2">
              {retreat.title}
            </h1>
            <div className="flex items-center space-x-4 text-white/80">
              {retreat.talks.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Globe size={16} />
                  <span>{retreat.talks[0].center?.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="col-span-2">
          <h2 className="text-xl font-medium mb-4">About this Retreat</h2>
          <p className="text-sage-600 mb-6">{retreat.description}</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-medium mb-4">Retreat Talks</h2>
        <div className="grid gap-4">
          {retreat.talks.map((talk) => (
            <TalkCard key={talk.slug} {...talk} retreat={retreat} />
          ))}
        </div>
      </div>
    </div>
  );
}
