import { drizzle } from "drizzle-orm/d1";
import * as schema from "~/db/schema";

export const db = (database: D1Database) => drizzle(database, { schema });
