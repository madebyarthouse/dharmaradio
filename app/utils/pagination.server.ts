import { count } from "drizzle-orm";
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

  const qb = query.limit(perPage).offset((page - 1) * perPage);

  const [items, total] = await queryWithCount(qb);
  const pages = Math.ceil(total / perPage);

  return {
    items,
    pagination: {
      total,
      pages,
      current: page,
    },
  };
}

export async function queryWithCount<T extends SQLiteSelect>(
  qb: T,
): Promise<[Awaited<T>, number]> {
  const result = await qb;
  // @ts-expect-error hack to override internals (not the ideal way)
  qb.config.fields = { count: count() };
  const [total] = await qb;
  return [result, total.count];
}
