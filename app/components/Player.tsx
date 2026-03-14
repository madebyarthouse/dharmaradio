import { useRef, useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useAudioWaveform } from "~/hooks/use-audio-waveform";
import { motion, AnimatePresence } from "motion/react";
import { Slider } from "~/components/ui/slider";

export function Player() {
  const {
    currentTalk,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    playNext,
    playPrevious,
    playlist,
  } = useAudio();

  const waveformRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Generate real waveform from audio file
  const { waveform, isLoading } = useAudioWaveform(currentTalk?.audioUrl ?? null, 60);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case "m":
          e.preventDefault();
          setVolume(volume > 0 ? 0 : 0.8);
          break;
        case "f":
          e.preventDefault();
          setIsMaximized(!isMaximized);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seek, currentTime, duration, setVolume, volume, isMaximized]);

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

  const currentIndex = playlist.findIndex(talk => talk.id === currentTalk.id);
  const hasNext = currentIndex !== -1 && currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex !== -1 && currentIndex > 0;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  if (isMaximized) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 neumorphic-card flex flex-col items-center justify-center p-8"
        >
          {/* Breathing animation background */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            style={{ opacity: 0.1 }}
          >
            <motion.div
              className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-400 to-purple-400 blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                x: ["-50%", "-50%", "-50%"],
                y: ["-50%", "-50%", "-50%"],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>

          {/* Minimize button */}
          <button
            onClick={() => setIsMaximized(false)}
            className="absolute top-6 right-6 neumorphic-button rounded-full w-10 h-10 flex items-center justify-center text-text-primary/70 hover:text-text-primary"
            aria-label="Minimize"
          >
            <Minimize2 size={18} />
          </button>

          {/* Content */}
          <div className="relative z-10 max-w-2xl w-full space-y-8">
            {/* Title */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-semibold text-text-primary">
                {currentTalk.title}
              </h2>
              {currentTalk.teacher && (
                <p className="text-lg text-text-secondary">{currentTalk.teacher}</p>
              )}
            </div>

            {/* Waveform Visualization */}
            <div
              ref={waveformRef}
              onClick={handleWaveformClick}
              className="h-32 flex items-center justify-center gap-1 cursor-pointer neumorphic-card-pressed rounded-2xl px-8"
            >
              <AnimatePresence mode="wait">
                {!isLoading && (
                  <motion.div
                    key={currentTalk.id}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex items-center justify-center gap-1 w-full h-full"
                  >
                    {waveform.map((height, i) => {
                      const barProgress = (i / waveform.length) * 100;
                      const isPlayed = barProgress < percentPlayed;
                      return (
                        <motion.div
                          key={i}
                          variants={{
                            hidden: { height: "10px" },
                            visible: {
                              height: `${height}%`,
                              transition: {
                                duration: 0.4,
                                ease: "easeOut",
                                delay: i * 0.005,
                              }
                            },
                            exit: {
                              height: "10px",
                              transition: {
                                duration: 0.3,
                                ease: "easeIn",
                                delay: 0,
                              }
                            },
                          }}
                          className="flex-1 rounded-full transition-colors duration-200"
                          style={{
                            backgroundColor: isPlayed
                              ? "rgb(59, 130, 246)"
                              : "rgb(203, 213, 225)",
                            minHeight: "10px",
                            maxHeight: "100%",
                            opacity: isPlayed ? 0.9 : 0.5,
                          }}
                        />
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={playPrevious}
                disabled={!hasPrevious}
                className="neumorphic-button rounded-full w-12 h-12 flex items-center justify-center text-text-primary/70 hover:text-text-primary disabled:opacity-30 active:scale-95 transition-transform cursor-pointer"
                aria-label="Previous"
              >
                <SkipBack size={20} />
              </button>

              <button
                onClick={togglePlay}
                className="neumorphic-button rounded-full w-16 h-16 flex items-center justify-center text-text-primary hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <Pause size={24} fill="currentColor" />
                ) : (
                  <Play size={24} fill="currentColor" className="ml-1" />
                )}
              </button>

              <button
                onClick={playNext}
                disabled={!hasNext}
                className="neumorphic-button rounded-full w-12 h-12 flex items-center justify-center text-text-primary/70 hover:text-text-primary disabled:opacity-30 active:scale-95 transition-transform cursor-pointer"
                aria-label="Next"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className="text-text-primary/70 hover:text-text-primary"
                aria-label="Toggle Mute"
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                className="w-32"
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[1200px] h-20 neumorphic-card rounded-2xl flex items-center px-6 z-50 gap-4"
      >
        {/* Track Info */}
        <div className="flex items-center gap-3 w-[200px] flex-shrink-0">
          {currentTalk.teacher && (
            <div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 bg-cover bg-center flex-shrink-0"
              style={{
                backgroundImage: currentTalk.teacher
                  ? `url(https://images.unsplash.com/photo-1555597408-26bc8e548a46?q=80&w=200&auto=format&fit=crop)`
                  : undefined,
                filter: "grayscale(90%) contrast(1.05)",
                boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.1)",
              }}
            />
          )}
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary leading-tight line-clamp-2">
              {currentTalk.title}
            </div>
            {currentTalk.teacher && (
              <div className="text-[0.65rem] text-text-secondary font-medium truncate">
                {currentTalk.teacher}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={playPrevious}
            disabled={!hasPrevious}
            className="neumorphic-button rounded-full w-8 h-8 flex items-center justify-center text-text-primary/70 hover:text-text-primary disabled:opacity-30 active:scale-90 transition-transform cursor-pointer"
            aria-label="Previous"
          >
            <SkipBack size={14} />
          </button>

          <button
            onClick={togglePlay}
            className="neumorphic-button rounded-full w-10 h-10 flex items-center justify-center text-text-primary hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            onClick={playNext}
            disabled={!hasNext}
            className="neumorphic-button rounded-full w-8 h-8 flex items-center justify-center text-text-primary/70 hover:text-text-primary disabled:opacity-30 active:scale-90 transition-transform cursor-pointer"
            aria-label="Next"
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Progress / Waveform */}
        <div className="flex-grow flex items-center gap-3">
          <span className="text-[0.65rem] text-text-secondary tabular-nums w-10 text-right font-medium">
            {formatTime(currentTime)}
          </span>

          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            className="flex-grow h-8 flex items-center justify-center cursor-pointer relative gap-0.5 px-2 neumorphic-card-pressed rounded-lg"
          >
            <AnimatePresence mode="wait">
              {!isLoading && (
                <motion.div
                  key={currentTalk.id}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex items-center justify-center gap-0.5 w-full h-full"
                >
                  {waveform.map((height, i) => {
                    const barProgress = (i / waveform.length) * 100;
                    const isPlayed = barProgress < percentPlayed;
                    return (
                      <motion.div
                        key={i}
                        variants={{
                          hidden: { height: "6px" },
                          visible: {
                            height: `${height * 0.6}%`,
                            transition: {
                              duration: 0.4,
                              ease: "easeOut",
                              delay: i * 0.005,
                            }
                          },
                          exit: {
                            height: "6px",
                            transition: {
                              duration: 0.3,
                              ease: "easeIn",
                              delay: 0,
                            }
                          },
                        }}
                        className="flex-1 rounded-full transition-colors duration-150"
                        style={{
                          backgroundColor: isPlayed
                            ? "rgb(59, 130, 246)"
                            : "rgb(203, 213, 225)",
                          minHeight: "6px",
                          opacity: isPlayed ? 0.85 : 0.4,
                        }}
                      />
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span className="text-[0.65rem] text-text-secondary tabular-nums w-10 font-medium">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume & Maximize */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="neumorphic-button rounded-full w-8 h-8 flex items-center justify-center text-text-primary/70 hover:text-text-primary"
              aria-label="Volume"
            >
              {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            {showVolumeSlider && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full mb-2 right-0 neumorphic-card p-3 rounded-xl"
              >
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  orientation="vertical"
                  className="h-20"
                />
              </motion.div>
            )}
          </div>

          <button
            onClick={() => setIsMaximized(true)}
            className="neumorphic-button rounded-full w-8 h-8 flex items-center justify-center text-text-primary/70 hover:text-text-primary"
            aria-label="Maximize"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default Player;
