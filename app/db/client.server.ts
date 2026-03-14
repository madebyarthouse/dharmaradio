import { drizzle } from "drizzle-orm/d1";
import * as schema from "~/db/schema";

const shouldLogQueries = () => process.env.DB_QUERY_LOG === "1";

export const db = (database: D1Database) =>
  drizzle(database, {
    schema,
    logger: shouldLogQueries()
      ? {
          logQuery: (query, time) => {
            console.log(query, time);
          },
        }
      : false,
  });
