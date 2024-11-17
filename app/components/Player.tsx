import { useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { Link } from "@remix-run/react";

export function Player() {
  const {
    currentTalk,
    isPlaying,
    togglePlay,
    progress,
    currentTime,
    duration,
    seek,
  } = useAudio();

  const progressBarRef = useRef<HTMLDivElement>(null);

  if (!currentTalk) return null;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return; // Only handle left click drag
    handleProgressClick(e);
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-green-200 p-4 shadow-lg"
    >
      <div className="container mx-auto flex flex-row gap-5 items-center justify-between">
        <div className="flex-1 max-w-[250px]">
          <div className="flex items-center justify-center space-x-6">
            <button className="text-green-600 hover:text-green-900 transition-colors">
              <SkipBack size={20} />
            </button>
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-900 flex items-center justify-center transition-colors"
            >
              {isPlaying ? (
                <Pause size={24} />
              ) : (
                <Play size={24} className="ml-1" />
              )}
            </button>
            <button className="text-green-600 hover:text-green-900 transition-colors">
              <SkipForward size={20} />
            </button>
          </div>
          <div className="mt-2 px-4">
            <div
              role="button"
              tabIndex={0}
              ref={progressBarRef}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  seek(currentTime - 10);
                } else if (e.key === "ArrowRight") {
                  seek(currentTime + 10);
                } else if (e.key === " ") {
                  e.preventDefault();
                  togglePlay();
                }
              }}
              onClick={handleProgressClick}
              onMouseMove={handleProgressDrag}
              className="h-2 bg-green-200 rounded-full cursor-pointer relative group"
            >
              <div className="absolute -top-2 -bottom-2 left-0 right-0 group-hover:bg-green-900/5 rounded-full" />
              <motion.div
                className="absolute top-0 left-0 h-full bg-green-600 rounded-full"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
              </motion.div>
            </div>
            <div className="flex justify-between text-xs text-green-600 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col flex-1">
          <h3 className="font-medium text-green-900">{currentTalk.title}</h3>
          <div className="flex flex-wrap gap-3 text-sm text-green-600">
            {currentTalk.teacher && currentTalk.teacherSlug && (
              <Link
                to={`/teachers/${currentTalk.teacherSlug}`}
                className="flex items-center gap-1 hover:text-green-900 transition-colors"
              >
                {currentTalk.teacher}
              </Link>
            )}
            {currentTalk.centerName && currentTalk.centerSlug && (
              <Link
                to={`/centers/${currentTalk.centerSlug}`}
                className="flex items-center gap-1 hover:text-green-900 transition-colors"
              >
                {currentTalk.centerName}
              </Link>
            )}
            {currentTalk.retreatTitle && currentTalk.retreatSlug && (
              <Link
                to={`/retreats/${currentTalk.retreatSlug}`}
                className="flex items-center gap-1 hover:text-green-900 transition-colors"
              >
                {currentTalk.retreatTitle}{" "}
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default Player;
