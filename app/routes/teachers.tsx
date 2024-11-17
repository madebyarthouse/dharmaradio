import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { like } from "drizzle-orm";
import { Search } from "lucide-react";
import { TeacherCard } from "~/components/teacher-card";
import { db } from "~/db/client.server";
import { teachers } from "~/db/schema";
import { Env } from "~/types";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  const results = await db((context.env as Env).DB).query.teachers.findMany({
    where: search ? like(teachers.name, `%${search}%`) : undefined,
    orderBy: (teachers, { desc }) => [desc(teachers.name)],
    limit: 50,
    with: {
      talks: {
        limit: 5,
      },
    },
  });

  return { teachers: results };
}

export default function Teachers() {
  const { teachers } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif">Teachers</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Search teachers..."
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

      <div className="grid gap-4">
        {teachers.map((teacher) => (
          <TeacherCard key={teacher.slug} {...teacher} />
        ))}
      </div>
    </div>
  );
}
