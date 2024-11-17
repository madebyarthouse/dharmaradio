import { Link } from "@remix-run/react";

type CenterCardProps = {
  slug: string;
  name: string;
  description: string | null;
  talksCount: number;
  teachersCount: number;
  retreatsCount: number;
};

export function CenterCard({
  slug,
  name,
  description,
  talksCount,
  teachersCount,
  retreatsCount,
}: CenterCardProps) {
  return (
    <Link
      to={`/centers/${slug}`}
      className="bg-white/60 backdrop-blur p-4 rounded-lg hover:shadow-md transition-all border border-sage-100"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium text-sage-900">{name}</h3>
        <p className="text-sage-600 text-sm line-clamp-2">{description}</p>

        <div className="flex gap-4 mt-2">
          <div className="text-sm text-sage-600">
            <span className="font-medium text-sage-900">{talksCount}</span>{" "}
            talks
          </div>
          <div className="text-sm text-sage-600">
            <span className="font-medium text-sage-900">{teachersCount}</span>{" "}
            teachers
          </div>
          <div className="text-sm text-sage-600">
            <span className="font-medium text-sage-900">{retreatsCount}</span>{" "}
            retreats
          </div>
        </div>
      </div>
    </Link>
  );
}
