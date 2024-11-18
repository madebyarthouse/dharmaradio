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
  centerName?: string | null;
  centerSlug?: string | null;
  retreatTitle?: string | null;
  retreatSlug?: string | null;
  audioUrl: string;
  id: number;
};

export function TalkCard({
  slug,
  title,
  duration,
  teacherName,
  teacherSlug,
  centerName,
  centerSlug,
  retreatTitle,
  retreatSlug,
  audioUrl,
  id,
}: Omit<TalkCardProps, "description">) {
  const { playTalk, currentTalk, isPlaying, pauseTalk } = useAudio();
  const isCurrentlyPlaying = currentTalk?.id === id && isPlaying;

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
        id,
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
    <div className="bg-white/60 backdrop-blur rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
      <Link to={`/talks/${slug}`} className="flex items-center space-x-4">
        <div className="relative w-12 h-12 flex-shrink-0">
          <button
            onClick={handlePlayToggle}
            className="w-full h-full rounded-lg bg-sage-100 group-hover:bg-sage-200 transition-colors flex items-center justify-center"
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
                <Pause className="text-sage-600" size={24} />
              ) : (
                <Play className="text-sage-600" size={24} />
              )}
            </motion.div>
          </button>
          {isCurrentlyPlaying && (
            <motion.div
              className="absolute inset-0 rounded-lg border-2 border-sage-400"
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
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sage-900 group-hover:text-sage-700 transition-colors">
            {title}
          </h3>
          <Link
            to={`/teachers/${teacherSlug}`}
            className="text-sage-600 text-sm hover:text-sage-900 transition-colors"
          >
            {teacherName}
          </Link>
          <div className="flex items-center space-x-2 mt-1 text-xs text-sage-500">
            <Clock size={12} />
            <span>{formatDuration(duration)}</span>
            {(centerName || retreatTitle) && <span>•</span>}
            {centerName && centerSlug && (
              <Link
                to={`/centers/${centerSlug}`}
                className="hover:text-sage-900 transition-colors"
              >
                {centerName}
              </Link>
            )}
            {retreatTitle && retreatSlug && (
              <>
                <span>•</span>
                <Link
                  to={`/retreats/${retreatSlug}`}
                  className="hover:text-sage-900 transition-colors"
                >
                  {retreatTitle}
                </Link>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
