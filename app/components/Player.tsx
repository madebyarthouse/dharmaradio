import { useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useAudioWaveform } from "~/hooks/use-audio-waveform";
import { motion, AnimatePresence } from "motion/react";

export function Player() {
  const {
    currentTalk,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
  } = useAudio();

  const waveformRef = useRef<HTMLDivElement>(null);

  // Generate real waveform from audio file
  const { waveform, isLoading } = useAudioWaveform(currentTalk?.audioUrl ?? null, 80);

  if (!currentTalk) return null;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const percentPlayed = (currentTime / duration) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-6rem)] max-w-[1200px] h-24 neumorphic-card rounded-2xl flex items-center px-8 z-50 gap-6"
      >
        {/* Track Info */}
        <div className="flex items-center gap-4 w-[220px] flex-shrink-0">
          {currentTalk.teacher && (
            <div
              className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 bg-cover bg-center flex-shrink-0"
              style={{
                backgroundImage: currentTalk.teacher
                  ? `url(https://images.unsplash.com/photo-1555597408-26bc8e548a46?q=80&w=200&auto=format&fit=crop)`
                  : undefined,
                filter: "grayscale(90%) contrast(1.05)",
                boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.1)",
              }}
            />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-sm font-semibold text-text-primary truncate">
              {currentTalk.title}
            </div>
            {currentTalk.teacher && (
              <div className="text-[0.7rem] text-text-secondary font-medium truncate">
                {currentTalk.teacher}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            className="neumorphic-button rounded-full w-9 h-9 flex items-center justify-center text-text-primary/70 hover:text-text-primary"
            aria-label="Previous"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={togglePlay}
            className="neumorphic-button rounded-full w-12 h-12 flex items-center justify-center text-text-primary hover:scale-105 transition-transform"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            className="neumorphic-button rounded-full w-9 h-9 flex items-center justify-center text-text-primary/70 hover:text-text-primary"
            aria-label="Next"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Progress / Waveform */}
        <div className="flex-grow flex items-center gap-4">
          <span className="text-[0.7rem] text-text-secondary tabular-nums w-12 text-right font-medium">
            {formatTime(currentTime)}
          </span>

          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            className="flex-grow h-[40px] flex items-end justify-between cursor-pointer relative gap-[2px] px-2 neumorphic-card-pressed rounded-lg"
          >
            {isLoading ? (
              <div className="flex items-center justify-center w-full h-full text-text-tertiary text-xs">
                Analyzing audio...
              </div>
            ) : (
              waveform.map((height, i) => {
                const barProgress = (i / waveform.length) * 100;
                const isPlayed = barProgress < percentPlayed;
                return (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.01, duration: 0.3 }}
                    className={`flex-1 rounded-t-sm transition-all duration-200 ${
                      isPlayed
                        ? "bg-gradient-to-t from-blue-400 to-blue-500"
                        : "bg-gradient-to-t from-gray-300 to-gray-400"
                    }`}
                    style={{
                      height: `${height}%`,
                      minHeight: "4px",
                      opacity: isPlayed ? 0.9 : 0.5,
                    }}
                  />
                );
              })
            )}
          </div>

          <span className="text-[0.7rem] text-text-secondary tabular-nums w-12 font-medium">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume button */}
        <button
          className="neumorphic-button rounded-full w-9 h-9 flex items-center justify-center text-text-primary/70 hover:text-text-primary ml-2"
          aria-label="Volume"
        >
          <Volume2 size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default Player;
