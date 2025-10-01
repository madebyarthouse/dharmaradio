import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { usePostHog } from "posthog-js/react";
import { trackPlausibleEvent } from "~/utils/plausible";

type Talk = {
  id: string;
  title: string;
  teacher: string | null;
  duration: number;
  audioUrl: string;
};

type AudioContextType = {
  currentTalk: PlayerTalk | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  playTalk: (talk: PlayerTalk) => void;
  pauseTalk: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
};

type PlayerTalk = Talk & {
  teacherSlug: string | null | undefined;
  centerName: string | null | undefined;
  centerSlug: string | null | undefined;
  retreatTitle: string | null | undefined;
  retreatSlug: string | null | undefined;
};

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTalk, setCurrentTalk] = useState<PlayerTalk | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);

      // Track talk completion
      if (currentTalk) {
        posthog?.capture("talk_completed", {
          talk_id: currentTalk.id,
          talk_title: currentTalk.title,
          teacher_name: currentTalk.teacher,
          teacher_slug: currentTalk.teacherSlug,
          center_name: currentTalk.centerName,
          center_slug: currentTalk.centerSlug,
          retreat_title: currentTalk.retreatTitle,
          retreat_slug: currentTalk.retreatSlug,
          duration: currentTalk.duration,
        });
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [currentTalk, posthog]);

  const playTalk = useCallback(
    (talk: PlayerTalk) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (currentTalk?.id !== talk.id) {
        audio.src = talk.audioUrl;
        setCurrentTalk(talk);
      }

      // Using the play promise to handle autoplay restrictions
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            trackPlausibleEvent({
              event: "play",
              url: window.location.href,
              props: {
                talk_id: talk.title ?? "",
              },
            });

            // Track with PostHog
            posthog?.capture("talk_played", {
              talk_id: talk.id,
              talk_title: talk.title,
              teacher_name: talk.teacher,
              teacher_slug: talk.teacherSlug,
              center_name: talk.centerName,
              center_slug: talk.centerSlug,
              retreat_title: talk.retreatTitle,
              retreat_slug: talk.retreatSlug,
              duration: talk.duration,
              audio_url: talk.audioUrl,
            });

            setIsPlaying(true);
          })
          .catch((error) => {
            console.error("Playback failed:", error);
            setIsPlaying(false);
          });
      }
    },
    [currentTalk?.id, posthog],
  );

  const pauseTalk = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);

    // Track pause event
    if (currentTalk) {
      posthog?.capture("talk_paused", {
        talk_id: currentTalk.id,
        talk_title: currentTalk.title,
        teacher_name: currentTalk.teacher,
        current_time: audio.currentTime,
        duration: currentTalk.duration,
        progress_percent: (audio.currentTime / audio.duration) * 100,
      });
    }
  }, [currentTalk, posthog]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pauseTalk();
    } else if (currentTalk) {
      playTalk(currentTalk);
    }
  }, [isPlaying, currentTalk, pauseTalk, playTalk]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const previousTime = audio.currentTime;
      audio.currentTime = time;
      setCurrentTime(time);
      setProgress((time / audio.duration) * 100);

      // Track seek event
      if (currentTalk && Math.abs(time - previousTime) > 5) {
        // Only track if seeking more than 5 seconds
        posthog?.capture("talk_seeked", {
          talk_id: currentTalk.id,
          talk_title: currentTalk.title,
          from_time: previousTime,
          to_time: time,
          seek_direction: time > previousTime ? "forward" : "backward",
          seek_amount: Math.abs(time - previousTime),
        });
      }
    },
    [currentTalk, posthog],
  );

  return (
    <AudioContext.Provider
      value={{
        currentTalk,
        isPlaying,
        progress,
        currentTime,
        duration,
        playTalk,
        pauseTalk,
        togglePlay,
        seek,
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" />
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
