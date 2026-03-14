# Database Guide

This guide covers the database schema, migrations, and query patterns used in Dharma Radio.

## Technology

- **Database**: Cloudflare D1 (serverless SQLite)
- **ORM**: Drizzle ORM (type-safe, SQL-like)
- **Migrations**: Drizzle Kit (version-controlled schema changes)

## Schema Overview

The database consists of four main tables with relationships:

```
teachers (1) ─┐
              ├──> talks (many)
centers (1) ──┤
              │
retreats (1) ─┘
```

## Tables

### Teachers

Buddhist teachers who give dharma talks.

**Schema** (`app/db/schema.ts`):
```typescript
{
  id: integer (PK),
  slug: text (unique),
  name: text,
  description: text (nullable),
  profileImageUrl: text (nullable),
  websiteUrl: text (nullable),
  donationUrl: text (nullable),
  dharmaSeedId: integer (unique),
  publishedOn: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Indexes**:
- Unique: `slug`, `dharmaSeedId`
- Search: `name`
- Sort: `createdAt`, `publishedOn`, `updatedAt`
- Compound: `name + publishedOn`

### Talks

Individual dharma talks (audio recordings).

**Schema**:
```typescript
{
  id: integer (PK),
  slug: text (unique),
  title: text,
  description: text (nullable),
  audioUrl: text,
  externalGuid: text,
  teacherId: integer (FK -> teachers),
  centerId: integer (FK -> centers, nullable),
  retreatId: integer (FK -> retreats, nullable),
  dharmaSeedId: integer (unique),
  duration: integer (seconds),
  publicationDate: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Indexes**:
- Unique: `slug`, `dharmaSeedId`
- Foreign Keys: `teacherId`, `centerId`, `retreatId`
- Search: `title`, `description`
- Sort: `title`, `duration`, `publicationDate`
- Compound: `teacherId + publicationDate`, `centerId + publicationDate`, etc.

### Centers

Meditation centers and organizations.

**Schema**:
```typescript
{
  id: integer (PK),
  slug: text (unique),
  name: text (unique),
  description: text (nullable),
  dharmaSeedSubdomain: text (unique),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Indexes**:
- Unique: `slug`, `name`, `dharmaSeedSubdomain`
- Search: `description`
- Sort: `createdAt`, `updatedAt`

### Retreats

Multi-day retreat events.

**Schema**:
```typescript
{
  id: integer (PK),
  slug: text (unique),
  title: text,
  description: text (nullable),
  language: text,
  dharmaSeedId: integer (unique),
  lastBuildDate: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Indexes**:
- Unique: `slug`, `dharmaSeedId`
- Search: `title`, `description`
- Filter: `language`
- Sort: `createdAt`, `updatedAt`

## Relationships

Defined in `app/db/schema.ts` using Drizzle relations:

```typescript
// One teacher has many talks
teachersRelations = relations(teachers, ({ many }) => ({
  talks: many(talks)
}))

// One talk belongs to one teacher (required)
// One talk belongs to one center (optional)
// One talk belongs to one retreat (optional)
talksRelations = relations(talks, ({ one }) => ({
  teacher: one(teachers, {
    fields: [talks.teacherId],
    references: [teachers.id]
  }),
  center: one(centers, { ... }),
  retreat: one(retreats, { ... })
}))
```

## Migrations

### Creating Migrations

1. Modify schema in `app/db/schema.ts`
2. Generate migration files:
   ```bash
   pnpm drizzle:update
   ```
3. Review generated SQL in `app/db/migrations/`

### Applying Migrations

**Local** (development):
```bash
pnpm drizzle:migrate:local
```

**Remote** (production):
```bash
pnpm drizzle:migrate:remote
```

### Migration Files

Located in `app/db/migrations/`:
- `0000_*.sql` - SQL statements
- `meta/0000_snapshot.json` - Schema snapshot
- `meta/_journal.json` - Migration log

## Database Client

### Initialization

**File**: `app/db/client.server.ts`

```typescript
import { drizzle } from "drizzle-orm/d1";

export const db = (database: D1Database) => {
  return drizzle(database, { schema });
};
```

### Usage in Loaders

```typescript
export async function loader({ context }: LoaderFunctionArgs) {
  const database = db(context.cloudflare.env.DB);

  const results = await database
    .select()
    .from(talks)
    .where(eq(talks.teacherId, 123));

  return json(results);
}
```

## Query Patterns

### Basic Select

```typescript
const allTalks = await db
  .select()
  .from(talks);
```

### With Filters

```typescript
const filteredTalks = await db
  .select()
  .from(talks)
  .where(like(talks.title, '%meditation%'));
```

### With Joins

```typescript
const talksWithTeachers = await db
  .select({
    id: talks.id,
    title: talks.title,
    teacherName: teachers.name,
  })
  .from(talks)
  .leftJoin(teachers, eq(talks.teacherId, teachers.id));
```

### With Ordering

```typescript
import { desc } from "drizzle-orm";

const sortedTalks = await db
  .select()
  .from(talks)
  .orderBy(desc(talks.publicationDate));
```

### With Pagination

Using the `withPagination` helper (see `app/utils/pagination.server.ts`):

```typescript
import { totalCountField, withPagination } from "~/utils/pagination.server";

const query = db
  .select({
    ...talks,
    ...totalCountField, // Adds window function for total count
  })
  .from(talks);

const { items, pagination } = await withPagination({
  query: query.$dynamic(),
  params: { page: 1, perPage: 20 },
});

// Returns:
// items: [...],
// pagination: { total: 1000, pages: 50, current: 1 }
```

### Upsert (Insert with Conflict Handling)

```typescript
await db
  .insert(teachers)
  .values({
    name: "New Teacher",
    slug: "new-teacher",
    dharmaSeedId: 123,
  })
  .onConflictDoUpdate({
    target: teachers.dharmaSeedId,
    set: {
      name: "Updated Teacher",
      updatedAt: sql`CURRENT_TIMESTAMP`,
    },
  });
```

### Batch Insert

```typescript
import { batch } from "~/sync/lib/batch";

const talksToInsert = [...]; // Large array

await batch(talksToInsert, async (chunk) => {
  await db.insert(talks).values(chunk);
}, 50); // 50 items per batch
```

## Index Strategy

### Types of Indexes

1. **Unique Indexes**: Enforce uniqueness (slug, dharmaSeedId)
2. **Foreign Key Indexes**: Speed up joins (teacherId, centerId)
3. **Search Indexes**: Full-text search (title, description)
4. **Sort Indexes**: Order by operations (publicationDate, duration)
5. **Compound Indexes**: Multi-column queries (teacherId + publicationDate)

### When to Add Indexes

Add indexes for:
- Columns in WHERE clauses
- Columns in ORDER BY clauses
- Foreign key columns
- Columns frequently searched

Don't over-index:
- Write performance impact
- Storage overhead
- D1 has index limits

### Compound Index Example

For queries like "get talks by teacher, sorted by date":

```typescript
// Schema definition
teacherPublicationIdx: index("talk_teacher_publication_idx").on(
  talks.teacherId,
  talks.publicationDate
)

// Query that uses it
const query = db
  .select()
  .from(talks)
  .where(eq(talks.teacherId, 123))
  .orderBy(desc(talks.publicationDate));
```

## Performance Tips

### Use Specific Selects

❌ Bad (selects everything):
```typescript
const talks = await db.select().from(talks);
```

✅ Good (selects only needed fields):
```typescript
const talks = await db.select({
  id: talks.id,
  title: talks.title,
}).from(talks);
```

### Use Prepared Statements

For repeated queries:

```typescript
const getTalkBySlug = db
  .select()
  .from(talks)
  .where(eq(talks.slug, sql.placeholder('slug')))
  .prepare();

const talk = await getTalkBySlug.execute({ slug: 'some-talk' });
```

### Limit Large Queries

Always use pagination:

```typescript
// Add .limit() and .offset()
const talks = await db
  .select()
  .from(talks)
  .limit(20)
  .offset(0);
```

### Use Window Functions for Counts

Instead of two queries (one for data, one for count), use window function:

```typescript
const results = await db.select({
  ...talks,
  total_count: sql<number>`count(*) OVER()`.as("total_count"),
}).from(talks);

const total = results[0]?.total_count ?? 0;
```

## Database Tools

### Drizzle Studio

Visual database browser:

```bash
pnpm drizzle:studio
```

Opens at https://local.drizzle.studio

### Wrangler CLI

Direct D1 access:

```bash
# Query local database
npx wrangler d1 execute dharmaradio --local --command="SELECT COUNT(*) FROM talks"

# Import SQL file
npx wrangler d1 execute dharmaradio --local --file=./fixtures/dump.sql
```

### Export Data

```bash
# Export to SQL
npx wrangler d1 export dharmaradio --local --output=dump.sql

# Export to JSON (via query)
npx wrangler d1 execute dharmaradio --local --command="SELECT * FROM talks" --json > talks.json
```

## Backup & Recovery

### Local Backup

The local D1 database is stored in `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`.

Copy this directory to back up.

### Remote Backup

Use Wrangler to export:

```bash
npx wrangler d1 export dharmaradio --remote --output=backup.sql
```

### Restore

```bash
# Local
npx wrangler d1 execute dharmaradio --local --file=backup.sql

# Remote
npx wrangler d1 execute dharmaradio --remote --file=backup.sql
```

## Troubleshooting

### Migration Failed

1. Check SQL syntax in migration file
2. Verify schema changes are valid
3. Roll back: Delete latest migration, regenerate

### Query Performance

1. Check query plan: `EXPLAIN QUERY PLAN <query>`
2. Add missing indexes
3. Reduce selected columns
4. Use pagination

### Connection Issues

Local:
- Ensure `pnpm dev` is running
- Check `.wrangler/` directory exists

Remote:
- Verify env vars in `.env`
- Check Cloudflare account permissions

## Next Steps

- [Data Sync Guide](./data-sync.md) - How data is populated
- [Routing & Loaders](./routing-loaders.md) - How to query in routes
- [API Reference](./api-reference.md) - Database query helpers
