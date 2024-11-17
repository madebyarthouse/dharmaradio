import { Link } from "@remix-run/react";

type TeacherCardProps = {
  slug: string;
  name: string;
  description: string | null;
  profileImageUrl: string | null;
};

export function TeacherCard({
  slug,
  name,
  description,
  profileImageUrl,
}: TeacherCardProps) {
  return (
    <Link
      to={`/teachers/${slug}`}
      className="bg-white/60 backdrop-blur rounded-xl p-6 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-center space-x-4">
        <img
          src={profileImageUrl || ""}
          alt={name}
          className="w-16 h-16 rounded-full object-cover ring-2 ring-sage-100 group-hover:ring-sage-200 transition-all"
        />
        <div className="flex-1">
          <h3 className="font-medium text-sage-900 group-hover:text-sage-700 transition-colors">
            {name}
          </h3>
          <p className="text-sage-600 text-sm line-clamp-2">{description}</p>
        </div>
      </div>
    </Link>
  );
}
