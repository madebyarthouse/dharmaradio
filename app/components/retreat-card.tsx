import { Link } from "@remix-run/react";

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
      className="bg-white/60 backdrop-blur p-4 rounded-lg hover:shadow-md transition-all border border-green-100 block h-full"
    >
      <div className="flex flex-col gap-2 h-full justify-between">
        <h3 className="text-lg font-medium text-green-900">{title}</h3>
        <p className="text-green-800 text-sm line-clamp-2">{description}</p>

        <div className="flex gap-4 mt-2">
          <div className="text-sm text-green-800">
            <span className="font-medium text-green-900">{talksCount}</span>{" "}
            talks
          </div>
          <div className="text-sm text-green-800">
            <span className="font-medium text-green-900">{teachersCount}</span>{" "}
            teachers
          </div>
        </div>
      </div>
    </Link>
  );
}
