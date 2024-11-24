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

  // TODO: Currently we need to execute the count query first, then the paginated query.
  // Running these in parallel causes issues with the drizzle query.
  // This should be fixed to allow parallel execution for better performance.
  // const allItems = await query.$dynamic();
  // const total = allItems.length;
  // const pages = Math.ceil(total / perPage);

  const items = await query.limit(perPage).offset((page - 1) * perPage);

  return {
    items,
    pagination: {
      total: 1,
      pages: 1,
      current: page,
    },
  };
}
