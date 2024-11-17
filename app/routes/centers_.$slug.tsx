import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { centers } from "~/db/schema";
import { Env } from "~/types";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Center slug is required");
  }

  const center = await db(context.cloudflare.env.DB).query.centers.findFirst({
    where: eq(centers.slug, slug),
    with: {
      talks: {
        limit: 5,
        with: {
          teacher: {
            columns: {
              name: true,
              profileImageUrl: true,
              slug: true,
            },
          },
          retreat: {
            columns: {
              title: true,
            },
          },
        },
      },
    },
  });

  if (!center) {
    throw new Error("Center not found");
  }

  return { center };
}

export default function CenterDetail() {
  const { center } = useLoaderData<typeof loader>();

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
              {center.name}
            </h1>
            <div className="flex items-center space-x-2 text-white/80">
              <MapPin size={16} />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="col-span-2">
          <h2 className="text-xl font-medium mb-4">About</h2>
          <p className="text-sage-600">{center.description}</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-medium mb-4">Recent Talks</h2>
        <div className="grid gap-4">
          {center.talks.map((talk) => (
            <TalkCard key={talk.slug} {...talk} center={center} />
          ))}
        </div>
      </div>
    </div>
  );
}
