import { Link } from "@remix-run/react";

type TeacherCardProps = {
  slug: string;
  name: string;
  description: string | null;
  profileImageUrl: string | null;
  talksCount: number;
  retreatsCount: number;
  centersCount: number;
};

export function TeacherCard({
  slug,
  name,
  description,
  profileImageUrl,
  talksCount,
  retreatsCount,
  centersCount,
}: TeacherCardProps) {
  return (
    <Link
      to={`/teachers/${slug}`}
      className="bg-white/60 backdrop-blur rounded-xl p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col gap-2 justify-between"
    >
      <div className="flex items-center gap-4 mb-4">
        {profileImageUrl && (
          <img
            src={profileImageUrl}
            alt={name}
            className="w-16 h-16 rounded-full flex-shrink-0 object-cover"
          />
        )}
        <h3 className="text-xl font-medium">{name}</h3>
      </div>
      {description && (
        <p className="text-green-800 line-clamp-3">{description}</p>
      )}

      <div className="flex gap-4 text-sm mt-2 text-green-800">
        <span>{talksCount} talks</span>
        <span>{retreatsCount} retreats</span>
        <span>{centersCount} centers</span>
      </div>
    </Link>
  );
}
