import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { motion } from "framer-motion";
import { Calendar, Clock, Building, Play, Pause } from "lucide-react";
import { db } from "~/db/client.server";
import { talks } from "~/db/schema";
import { eq } from "drizzle-orm";
import { useState } from "react";
import { Env } from "~/types";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Talk slug is required");
  }

  const database = db((context.env as Env).DB);

  const talk = await database.query.talks.findFirst({
    where: eq(talks.slug, slug),
    with: {
      teacher: {
        columns: {
          name: true,
        },
      },
      center: {
        columns: {
          name: true,
        },
      },
      retreat: {
        columns: {
          title: true,
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
        <div className="flex items-start space-x-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative group"
          >
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 flex items-center justify-center bg-sage-900/0 group-hover:bg-sage-900/20 rounded-lg transition-colors"
            >
              {isPlaying ? (
                <Pause
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  size={48}
                />
              ) : (
                <Play
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  size={48}
                />
              )}
            </button>
          </motion.div>

          <div className="flex-1">
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
              <div className="flex items-center space-x-2">
                <Building size={16} />
                <span>{talk.center?.name}</span>
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
        </div>
      </motion.div>
    </div>
  );
}
