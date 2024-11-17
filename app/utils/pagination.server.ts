import type { SQLiteSelect } from "drizzle-orm/sqlite-core";

export type PaginationParams = {
  page?: number;
  perPage?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: {
    total: number;
    pages: number;
    current: number;
  };
};

export async function withPagination<T extends SQLiteSelect>({
  query,
  params,
}: {
  query: T;
  params: PaginationParams;
}) {
  const { page = 1, perPage = 20 } = params;

  const countQuery = query.$dynamic();

  // Execute the paginated query
  const [items, count] = await Promise.all([
    query.limit(perPage).offset((page - 1) * perPage),
    countQuery.then((value) => value.length),
  ]);

  console.log(count, Math.ceil(Number(count) / perPage));

  return {
    items,
    pagination: {
      total: Number(count),
      pages: Math.ceil(Number(count) / perPage),
      current: page,
    },
  };
}
