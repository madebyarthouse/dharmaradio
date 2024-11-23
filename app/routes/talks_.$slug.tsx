import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq, sql } from "drizzle-orm";
import { motion } from "framer-motion";
import { Calendar, Clock, Play, Pause } from "lucide-react";
import { db } from "~/db/client.server";
import { talks, teachers, retreats, centers } from "~/db/schema";
import { useAudio } from "~/contexts/audio-context";
import { TeacherCard } from "~/components/teacher-card";
import { CenterCard } from "~/components/center-card";
import { RetreatCard } from "~/components/retreat-card";
import { cacheHeader } from "pretty-cache-header";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "1day",
    sMaxage: "7days",
    staleWhileRevalidate: "1month",
  }),
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Talk slug is required");
  }

  const database = db(context.cloudflare.env.DB);

  // Get talk with basic relations
  const talk = await database.query.talks.findFirst({
    where: eq(talks.slug, slug),
  });

  if (!talk) {
    throw new Response("Not Found", { status: 404 });
  }

  // Get teacher with counts
  const teacherQuery = database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      description: teachers.description,
      profileImageUrl: teachers.profileImageUrl,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      retreatsCount:
        sql<number>`count(distinct case when ${retreats.id} is not null then ${retreats.id} end)`.as(
          "retreats_count",
        ),
      centersCount:
        sql<number>`count(distinct case when ${centers.id} is not null then ${centers.id} end)`.as(
          "centers_count",
        ),
    })
    .from(teachers)
    .leftJoin(talks, eq(talks.teacherId, teachers.id))
    .leftJoin(retreats, eq(talks.retreatId, retreats.id))
    .leftJoin(centers, eq(talks.centerId, centers.id))
    .where(eq(teachers.id, talk.teacherId))
    .groupBy(teachers.id);

  // Get retreat with counts
  const retreatQuery = database
    .select({
      id: retreats.id,
      title: retreats.title,
      slug: retreats.slug,
      description: retreats.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
        "teachers_count",
      ),
    })
    .from(retreats)
    .leftJoin(talks, eq(talks.retreatId, retreats.id))
    .where(talk.retreatId ? eq(retreats.id, talk.retreatId) : undefined)
    .groupBy(retreats.id);

  // Get center with counts
  const centerQuery = database
    .select({
      id: centers.id,
      name: centers.name,
      slug: centers.slug,
      description: centers.description,
      talksCount: sql<number>`count(distinct ${talks.id})`.as("talks_count"),
      teachersCount: sql<number>`count(distinct ${talks.teacherId})`.as(
        "teachers_count",
      ),
      retreatsCount: sql<number>`count(distinct ${talks.retreatId})`.as(
        "retreats_count",
      ),
    })
    .from(centers)
    .leftJoin(talks, eq(talks.centerId, centers.id))
    .where(talk.centerId ? eq(centers.id, talk.centerId) : undefined)
    .groupBy(centers.id);

  const [teacher] = await teacherQuery;
  const [retreat] = await retreatQuery;
  const [center] = await centerQuery;

  return {
    talk: {
      ...talk,
      teacher,
      retreat,
      center,
    },
  };
}

export default function TalkDetail() {
  const { talk } = useLoaderData<typeof loader>();
  const { playTalk, pauseTalk, isPlaying, currentTalk } = useAudio();
  const isCurrentlyPlaying = currentTalk?.id === String(talk.id) && isPlaying;

  const handlePlayToggle = () => {
    if (isCurrentlyPlaying) {
      pauseTalk();
    } else {
      playTalk({
        id: String(talk.id),
        title: talk.title,
        teacher: talk.teacher?.name || null,
        duration: talk.duration,
        audioUrl: talk.audioUrl,
        teacherSlug: talk.teacher?.slug || null,
        centerName: talk.center?.name || null,
        centerSlug: talk.center?.slug || null,
        retreatTitle: talk.retreat?.title || null,
        retreatSlug: talk.retreat?.slug || null,
      });
    }
  };

  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/60 backdrop-blur rounded-xl p-8 shadow-sm mb-8"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-serif"
            >
              {talk.title}
            </motion.h1>
            <motion.button
              onClick={handlePlayToggle}
              className="relative w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={
                  isCurrentlyPlaying
                    ? {
                        scale: [1, 1.2, 1],
                        transition: {
                          repeat: Infinity,
                          duration: 2,
                          ease: "easeInOut",
                        },
                      }
                    : {}
                }
              >
                {isCurrentlyPlaying ? (
                  <Pause size={32} />
                ) : (
                  <Play size={32} className="ml-1" />
                )}
              </motion.div>
              {isCurrentlyPlaying && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [1, 0, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </motion.button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-4 text-sm text-green-800 mb-4"
          >
            <div className="flex items-center space-x-2">
              <Calendar size={16} />
              <span>{new Date(talk.publicationDate).toLocaleDateString()}</span>
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
            className="text-green-800"
          >
            {talk.description}
          </motion.p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {talk.teacher && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TeacherCard
              {...talk.teacher}
              talksCount={Number(talk.teacher.talksCount)}
              retreatsCount={Number(talk.teacher.retreatsCount)}
              centersCount={Number(talk.teacher.centersCount)}
            />
          </motion.div>
        )}

        {talk.retreat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <RetreatCard
              {...talk.retreat}
              talksCount={Number(talk.retreat.talksCount)}
              teachersCount={Number(talk.retreat.teachersCount)}
            />
          </motion.div>
        )}

        {talk.center && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <CenterCard
              {...talk.center}
              talksCount={Number(talk.center.talksCount)}
              teachersCount={Number(talk.center.teachersCount)}
              retreatsCount={Number(talk.center.retreatsCount)}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
