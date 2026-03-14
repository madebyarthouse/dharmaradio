import { Play } from "lucide-react";
import { Link } from "react-router";
import { useAudio } from "~/contexts/audio-context";

type TalkFeedItemProps = {
  slug: string;
  title: string;
  duration: number;
  teacherName: string | null;
  teacherSlug: string | null;
  teacherProfileImageUrl: string | null;
  audioUrl: string;
  id: number;
};

export function TalkFeedItem({
  slug,
  title,
  duration,
  teacherName,
  teacherSlug,
  teacherProfileImageUrl,
  audioUrl,
  id,
}: TalkFeedItemProps) {
  const { playTalk, currentTalk, isPlaying } = useAudio();
  const isCurrentlyPlaying = currentTalk?.id === String(id) && isPlaying;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playTalk({
      id: String(id),
      title,
      teacher: teacherName,
      teacherSlug,
      duration,
      audioUrl,
    });
  };

  return (
    <Link
      to={`/talks/${slug}`}
      className="grid grid-cols-[40px_1fr_200px_100px] items-center py-4 border-b border-text-primary/5 cursor-pointer transition-all duration-300 hover:bg-white/40 hover:pl-4 hover:translate-x-[5px] group"
    >
      {/* Play icon */}
      <button
        onClick={handlePlayClick}
        className="w-6 h-6 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity"
        aria-label="Play talk"
      >
        <Play size={14} className="text-text-primary" />
      </button>

      {/* Title */}
      <div className="font-display text-[1.1rem] font-normal text-text-secondary transition-colors group-hover:text-text-primary pr-4">
        {title}
      </div>

      {/* Teacher */}
      <div className="flex items-center gap-3 text-[0.85rem] text-text-secondary">
        {teacherProfileImageUrl && (
          <div
            className="w-8 h-8 rounded-full bg-gray-200 bg-cover bg-center"
            style={{
              backgroundImage: `url(${teacherProfileImageUrl})`,
              filter: "grayscale(100%) contrast(1.1)",
            }}
          />
        )}
        {teacherName}
      </div>

      {/* Duration */}
      <div className="text-[0.75rem] text-text-tertiary text-right tabular-nums">
        {formatDuration(duration)}
      </div>
    </Link>
  );
}
