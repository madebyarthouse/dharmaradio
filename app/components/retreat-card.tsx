import { Link } from "react-router";

type RetreatCardProps = {
  slug: string;
  title: string;
  description: string | null;
  talksCount: number;
  teachersCount: number;
};

export function RetreatCard({
  slug,
  title,
  description,
  talksCount,
  teachersCount,
}: RetreatCardProps) {
  return (
    <Link
      to={`/retreats/${slug}`}
      className="neumorphic-card p-6 rounded-xl hover:shadow-lg transition-all block h-full group"
    >
      <div className="flex flex-col gap-3 h-full justify-between">
        <h3 className="text-lg font-semibold text-text-primary group-hover:text-blue-600 transition-colors">{title}</h3>
        <p className="text-text-secondary text-sm line-clamp-2 leading-relaxed">{description}</p>

        <div className="flex gap-4 pt-2 border-t border-text-primary/5">
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-primary">{talksCount}</span>{" "}
            talks
          </div>
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-primary">{teachersCount}</span>{" "}
            teachers
          </div>
        </div>
      </div>
    </Link>
  );
}
