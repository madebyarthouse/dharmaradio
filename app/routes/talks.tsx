import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Search, Filter } from "lucide-react";
import { TalkCard } from "~/components/talk-card";
import { db } from "~/db/client.server";
import { talks } from "~/db/schema";
import { like } from "drizzle-orm";
import { Env } from "~/types";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  const results = await db((context.env as Env).DB).query.talks.findMany({
    where: search ? like(talks.title, `%${search}%`) : undefined,
    orderBy: (talks, { desc }) => [desc(talks.publicationDate)],
    limit: 50,
    with: {
      teacher: {
        columns: {
          name: true,
        },
      },
      center: {
        columns: {
          name: true,
        },
      },
      retreat: {
        columns: {
          title: true,
        },
      },
    },
  });

  return { talks: results };
}

export default function Talks() {
  const { talks } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif">Talks</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search talks..."
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

      <div className="grid gap-4">
        {talks.map((talk) => (
          <TalkCard key={talk.slug} {...talk} />
        ))}
      </div>
    </div>
  );
}
