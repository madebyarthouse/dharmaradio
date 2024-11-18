import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { like } from "drizzle-orm";
import { TeacherCard } from "~/components/teacher-card";
import { db } from "~/db/client.server";
import { teachers } from "~/db/schema";
import { SearchInput } from "~/components/ui/search-input";
import { Suspense } from "react";
import { useSearchWithDebounce } from "~/utils/search-params";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  const results = await db(context.cloudflare.env.DB).query.teachers.findMany({
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
  const { searchTerm, setSearchTerm } = useSearchWithDebounce();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif">Teachers</h1>
        <div className="w-full md:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search teachers..."
          />
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <div className="animate-pulse">Loading...</div>
          </div>
        }
      >
        <div className="grid gap-4">
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.slug} {...teacher} />
          ))}
        </div>
      </Suspense>
    </div>
  );
}
