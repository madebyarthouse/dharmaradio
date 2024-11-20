import { SQL, asc, desc } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

type OrderingConfig = {
  [key: string]: {
    column: SQLiteColumn | SQL;
    transform?: (column: SQLiteColumn | SQL) => SQL;
  };
};

export function withOrdering<TSort extends string>({
  field,
  order,
  config,
}: {
  field: TSort;
  order: "asc" | "desc";
  config: OrderingConfig;
}) {
  const orderConfig = config[field];
  if (!orderConfig) {
    throw new Error(`Invalid sort field: ${field}`);
  }

  const { column, transform } = orderConfig;
  const sqlExpression = transform ? transform(column) : column;

  return order === "asc" ? asc(sqlExpression) : desc(sqlExpression);
}
