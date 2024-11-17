import { drizzle } from "drizzle-orm/d1";
import * as schema from "~/db/schema";

export const db = (database: D1Database) => drizzle(database, { schema });

export const dbWithCredentials = ({
  id,
  token,
  name,
}: {
  id: string;
  token: string;
  name: string;
}) => {
  const client = createClient({ databaseId: id, databaseToken: token });
  return drizzle(client, { schema });
};
