import React from "react";
import { Link } from "@remix-run/react";
import { Calendar, Globe, PlayCircle } from "lucide-react";

interface RetreatCardProps {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  language: string;
  talkCount: number;
  lastBuildDate: string;
}

const RetreatCard: React.FC<RetreatCardProps> = ({
  slug,
  title,
  description,
  imageUrl,
  language,
  talkCount,
  lastBuildDate,
}) => {
  return (
    <Link
      to={`/retreats/${slug}`}
      className="group bg-white/60 backdrop-blur rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative h-48">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-medium text-white mb-1">{title}</h3>
          <div className="flex items-center space-x-2 text-white/80 text-sm">
            <Globe size={14} />
            <span>{language}</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sage-600 text-sm line-clamp-2 mb-3">{description}</p>
        <div className="flex items-center justify-between text-xs text-sage-500">
          <div className="flex items-center space-x-2">
            <PlayCircle size={14} />
            <span>{talkCount} talks</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar size={14} />
            <span>{new Date(lastBuildDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default RetreatCard;
