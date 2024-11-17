import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { Calendar, Clock, Building, Play, Pause } from "lucide-react";
import { db } from "~/db/client.server";
import { talks } from "~/db/schema";
import { useState } from "react";
import { Link } from "@remix-run/react";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Talk slug is required");
  }

  const talk = await db(context.cloudflare.env.DB).query.talks.findFirst({
    where: eq(talks.slug, slug),
    with: {
      teacher: {
        columns: {
          name: true,
          slug: true,
          profileImageUrl: true,
          description: true,
        },
      },
      center: {
        columns: {
          name: true,
          slug: true,
          description: true,
        },
      },
      retreat: {
        columns: {
          title: true,
          slug: true,
          description: true,
        },
      },
    },
  });

  if (!talk) {
    throw new Response("Not Found", { status: 404 });
  }

  return { talk };
}

export default function TalkDetail() {
  const { talk } = useLoaderData<typeof loader>();
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/60 backdrop-blur rounded-xl p-8 shadow-sm mb-8"
      >
        <div className="flex flex-col gap-6">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-serif mb-2"
            >
              {talk.title}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap gap-4 text-sm text-sage-600 mb-4"
            >
              <div className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>
                  {new Date(talk.publicationDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={16} />
                <span>
                  {Math.floor(talk.duration / 60)}:
                  {String(talk.duration % 60).padStart(2, "0")}
                </span>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sage-600"
            >
              {talk.description}
            </motion.p>
          </div>

          {talk.teacher && (
            <Link
              to={`/teachers/${talk.teacher.slug}`}
              className="flex items-center gap-4 p-4 rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
            >
              {talk.teacher.profileImageUrl && (
                <img
                  src={talk.teacher.profileImageUrl}
                  alt={talk.teacher.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <h3 className="font-medium text-sage-900">
                  {talk.teacher.name}
                </h3>
                <p className="text-sm text-sage-600 line-clamp-1">
                  {talk.teacher.description}
                </p>
              </div>
            </Link>
          )}

          {talk.retreat && (
            <Link
              to={`/retreats/${talk.retreat.slug}`}
              className="p-4 rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
            >
              <h3 className="font-medium text-sage-900 mb-1">
                From retreat: {talk.retreat.title}
              </h3>
              <p className="text-sm text-sage-600 line-clamp-2">
                {talk.retreat.description}
              </p>
            </Link>
          )}

          {talk.center && (
            <Link
              to={`/centers/${talk.center.slug}`}
              className="p-4 rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
            >
              <h3 className="font-medium text-sage-900 mb-1">
                At {talk.center.name}
              </h3>
              <p className="text-sm text-sage-600 line-clamp-2">
                {talk.center.description}
              </p>
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
