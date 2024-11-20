import { Link } from "@remix-run/react";
import { Play, Pause, Clock } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { motion } from "framer-motion";

type TalkCardProps = {
  slug: string;
  title: string;
  duration: number;
  teacherName: string | null;
  teacherSlug: string | null;
  teacherProfileImageUrl: string | null;
  centerName: string | null;
  centerSlug: string | null;
  retreatTitle: string | null;
  retreatSlug: string | null;
  audioUrl: string;
  id: number;
};

export function TalkCard({
  slug,
  title,
  duration,
  teacherName,
  teacherSlug,
  teacherProfileImageUrl,
  centerName,
  centerSlug,
  retreatTitle,
  retreatSlug,
  audioUrl,
  id,
}: TalkCardProps) {
  const { playTalk, currentTalk, isPlaying, pauseTalk } = useAudio();
  const isCurrentlyPlaying = currentTalk?.id === String(id) && isPlaying;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isCurrentlyPlaying) {
      pauseTalk();
    } else {
      playTalk({
        id: String(id),
        title,
        teacher: teacherName,
        teacherSlug,
        retreatTitle,
        retreatSlug,
        centerName,
        centerSlug,
        duration,
        audioUrl,
      });
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur rounded-xl py-4 px-6 shadow-sm hover:shadow-md transition-all group block">
      <div className="flex items-center gap-10">
        <div className="flex items-center flex-col gap-2">
          <button
            onClick={handlePlayToggle}
            className="relative w-12 h-12 flex-shrink-0 rounded-lg bg-green-200 group-hover:bg-green-200 hover:!bg-green-3  00 transition-colors flex items-center justify-center"
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
                <Pause className="text-green-600" size={24} />
              ) : (
                <Play className="text-green-600 ml-1" size={24} />
              )}
            </motion.div>
            {isCurrentlyPlaying && (
              <motion.div
                className="absolute inset-0 rounded-lg border-2 border-green-600"
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
          </button>
          <div className="flex items-center text-xs gap-1">
            <Clock size={10} />
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center text-base gap-2 mt-1">
            {teacherProfileImageUrl && (
              <img
                src={teacherProfileImageUrl}
                alt={teacherName || ""}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            {teacherName && teacherSlug && (
              <Link
                to={`/teachers/${teacherSlug}`}
                className="notouch:hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {teacherName}
              </Link>
            )}
          </div>
          <Link to={`/talks/${slug}`}>
            <h3 className="font-medium notouch:hover:underline transition-colors  line-clamp-2 max-w-[50ch] text-xl">
              {title}
            </h3>
          </Link>

          <div className="mt-1 text-xs">
            {retreatTitle && retreatSlug && (
              <Link
                to={`/retreats/${retreatSlug}`}
                className="notouch:hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {retreatTitle}
              </Link>
            )}{" "}
            at{" "}
            {centerName && centerSlug && (
              <Link
                to={`/centers/${centerSlug}`}
                className="notouch:hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {centerName}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
