import { Link } from "@remix-run/react";
import { Play, Clock } from "lucide-react";

type TalkCardProps = {
  slug: string;
  title: string;
  teacher: {
    name: string;
  };
  duration: number;
  center: {
    name: string;
  } | null;
  retreat: {
    title: string;
  } | null;
};

export function TalkCard({
  slug,
  title,
  teacher,
  duration,
  center,
  retreat,
}: TalkCardProps) {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  };

  return (
    <div className="bg-white/60 backdrop-blur rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
      <Link to={`/talks/${slug}`} className="flex items-center space-x-4">
        <div className="relative">
          <div className="absolute inset-0 bg-sage-900/0 group-hover:bg-sage-900/20 rounded-lg transition-colors flex items-center justify-center">
            <Play
              className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              size={24}
            />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sage-900 group-hover:text-sage-700 transition-colors">
            {title}
          </h3>
          <p className="text-sage-600 text-sm">{teacher.name}</p>
          <div className="flex items-center space-x-2 mt-1 text-xs text-sage-500">
            <Clock size={12} />
            <span>{formatDuration(duration)}</span>
            <span>•</span>
            <span>{center?.name}</span>
            <span>•</span>
            <span>{retreat?.title}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
