import { Link } from "react-router";

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
      className="neumorphic-card rounded-xl p-6 hover:shadow-lg transition-all h-full flex flex-col gap-3 justify-between group"
    >
      <div className="flex items-center gap-4">
        {profileImageUrl && (
          <img
            src={profileImageUrl}
            alt={name}
            className="w-14 h-14 rounded-full flex-shrink-0 object-cover"
            style={{
              filter: "grayscale(90%) contrast(1.05)",
            }}
          />
        )}
        <h3 className="text-lg font-semibold text-text-primary group-hover:text-blue-600 transition-colors">{name}</h3>
      </div>
      {description && (
        <p className="text-text-secondary text-sm line-clamp-3 leading-relaxed">{description}</p>
      )}

      <div className="flex gap-4 text-xs text-text-tertiary pt-2 border-t border-text-primary/5">
        <span className="font-medium">{talksCount} talks</span>
        <span>{retreatsCount} retreats</span>
        <span>{centersCount} centers</span>
      </div>
    </Link>
  );
}
