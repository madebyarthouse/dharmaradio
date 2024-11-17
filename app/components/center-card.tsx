import { Link } from "@remix-run/react";

type CenterCardProps = {
  slug: string;
  name: string;
  description: string | null;
};

export function CenterCard({ slug, name, description }: CenterCardProps) {
  return (
    <Link
      to={`/centers/${slug}`}
      className="group bg-white/60 backdrop-blur rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative h-48">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-medium text-white mb-1">{name}</h3>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sage-600 text-sm line-clamp-2 mb-3">{description}</p>
      </div>
    </Link>
  );
}
