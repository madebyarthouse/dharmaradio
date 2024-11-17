import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { like } from "drizzle-orm";
import { Search } from "lucide-react";
import { CenterCard } from "~/components/center-card";
import { db } from "~/db/client.server";
import { centers } from "~/db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  const results = await db(context.cloudflare.env.DB).query.centers.findMany({
    where: search ? like(centers.name, `%${search}%`) : undefined,
    orderBy: (centers, { desc }) => [desc(centers.name)],
    limit: 50,
    with: {
      talks: {
        limit: 5,
        with: {
          teacher: {
            columns: {
              name: true,
              profileImageUrl: true,
              slug: true,
            },
          },
          retreat: {
            columns: {
              title: true,
            },
          },
        },
      },
    },
  });

  return { centers: results };
}

export default function Centers() {
  const { centers } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif">Meditation Centers</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Search centers..."
            value={search}
            onChange={(e) => setSearchParams({ q: e.target.value })}
            className="pl-10 pr-4 py-2 rounded-lg bg-white/60 backdrop-blur border border-sage-200 focus:border-sage-400 focus:ring focus:ring-sage-200 focus:ring-opacity-50 transition-all"
          />
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
            size={18}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {centers.map((center) => (
          <CenterCard key={center.slug} {...center} />
        ))}
      </div>
    </div>
  );
}
