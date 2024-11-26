import type { SQLiteSelect } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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

export const totalCountField = {
  total_count: sql<number>`count(*) OVER()`.as("total_count"),
};

export async function withPagination<T extends SQLiteSelect>({
  query,
  params,
}: {
  query: T;
  params: PaginationParams;
}): Promise<PaginatedResult<T>> {
  const { page = 1, perPage = 20 } = params;

  const results = await query
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  // Early return if no results
  if (!results.length) {
    return {
      items: [],
      pagination: {
        total: 0,
        pages: 0,
        current: page,
      },
    };
  }

  // Extract total from first row and remove total_count from results
  const total = Number(results[0].total_count);
  const items = results.map(({ total_count, ...rest }) => rest) as T[];

  return {
    items,
    pagination: {
      total,
      pages: Math.ceil(total / perPage),
      current: page,
    },
  };
}
