import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { like } from "drizzle-orm";
import { Search, Filter } from "lucide-react";
import { RetreatCard } from "~/components/retreat-card";
import { db } from "~/db/client.server";
import { retreats } from "~/db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  const results = await db(context.cloudflare.env.DB).query.retreats.findMany({
    where: search ? like(retreats.title, `%${search}%`) : undefined,
    limit: 50,
    with: {
      talks: {
        columns: {
          id: true,
        },
        limit: 1,
      },
    },
  });

  return { retreats: results };
}

export default function Retreats() {
  const { retreats } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif">Meditation Retreats</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search retreats..."
              value={search}
              onChange={(e) => setSearchParams({ q: e.target.value })}
              className="pl-10 pr-4 py-2 rounded-lg bg-white/60 backdrop-blur border border-sage-200 focus:border-sage-400 focus:ring focus:ring-sage-200 focus:ring-opacity-50 transition-all"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
              size={18}
            />
          </div>
          <button className="px-4 py-2 rounded-lg bg-white/60 backdrop-blur border border-sage-200 hover:border-sage-400 transition-colors flex items-center space-x-2">
            <Filter size={18} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {retreats.map((retreat) => (
          <RetreatCard key={retreat.slug} {...retreat} />
        ))}
      </div>
    </div>
  );
}
