import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { motion } from "framer-motion";
import { Globe, Heart, ExternalLink } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { teachers } from "~/db/schema";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Error("Teacher slug is required");
  }

  const teacher = await db(context.cloudflare.env.DB).query.teachers.findFirst({
    where: eq(teachers.slug, slug),
    with: {
      talks: {
        limit: 5,
        with: {
          center: {
            columns: {
              name: true,
              slug: true,
            },
          },
          retreat: {
            columns: {
              title: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  return { teacher };
}

export default function TeacherDetail() {
  const { teacher } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white/60 backdrop-blur rounded-xl p-8 shadow-sm mb-8"
      >
        <div className="flex flex-col md:flex-row md:items-start md:space-x-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-6 md:mb-0"
          >
            <img
              src={teacher.profileImageUrl || ""}
              alt={teacher.name}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-sage-100"
            />
          </motion.div>
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-serif mb-2 text-center md:text-left"
            >
              {teacher.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sage-600 mb-4"
            >
              {teacher.description}
            </motion.p>
            <div className="flex justify-center md:justify-start space-x-4">
              {teacher.websiteUrl && (
                <a
                  href={teacher.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-sage-600 hover:text-sage-900 transition-colors"
                >
                  <Globe size={16} />
                  <span>Website</span>
                  <ExternalLink size={12} />
                </a>
              )}
              {teacher.donationUrl && (
                <a
                  href={teacher.donationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm text-sage-600 hover:text-rose-500 transition-colors"
                >
                  <Heart size={16} />
                  <span>Support</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-medium mb-4">Recent Talks</h2>
        <div className="grid gap-4">
          {teacher.talks.map((talk) => (
            <TalkCard
              key={talk.slug}
              {...talk}
              teacherName={teacher.name}
              teacherSlug={teacher.slug}
              centerName={talk.center?.name ?? null}
              centerSlug={talk.center?.slug ?? null}
              retreatTitle={talk.retreat?.title ?? null}
              retreatSlug={talk.retreat?.slug ?? null}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
