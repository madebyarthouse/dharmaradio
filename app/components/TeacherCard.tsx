import React from "react";
import { Link } from "@remix-run/react";
import { Headphones } from "lucide-react";

interface TeacherCardProps {
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  talkCount: number;
}

const TeacherCard: React.FC<TeacherCardProps> = ({
  slug,
  name,
  description,
  imageUrl,
  talkCount,
}) => {
  return (
    <Link
      to={`/teachers/${slug}`}
      className="bg-white/60 backdrop-blur rounded-xl p-6 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-center space-x-4">
        <img
          src={imageUrl}
          alt={name}
          className="w-16 h-16 rounded-full object-cover ring-2 ring-sage-100 group-hover:ring-sage-200 transition-all"
        />
        <div className="flex-1">
          <h3 className="font-medium text-sage-900 group-hover:text-sage-700 transition-colors">
            {name}
          </h3>
          <p className="text-sage-600 text-sm line-clamp-2">{description}</p>
          <div className="flex items-center space-x-1 mt-2 text-xs text-sage-500">
            <Headphones size={12} />
            <span>{talkCount} talks</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default TeacherCard;
