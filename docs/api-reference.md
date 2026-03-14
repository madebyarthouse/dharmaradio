# API Reference

This document describes the API endpoints and utilities available in Dharma Radio.

## API Endpoints

### Sync API

**Endpoint**: `GET /api/sync`

Triggers data synchronization from dharmaseed.org.

**Query Parameters**:
- `command` (optional): Sync command - `teachers`, `talks`, or `all` (default: `all`)
- `skipProcessing` (optional): Skip expensive processing - `true` or `false` (default: `false`)

**Examples**:
```bash
# Full sync
GET /api/sync

# Sync only teachers
GET /api/sync?command=teachers

# Sync talks (fast mode)
GET /api/sync?command=talks&skipProcessing=true

# Sync everything
GET /api/sync?command=all
```

**Response**:
```json
{
  "success": true,
  "results": {
    "teachers": { "success": true },
    "talks": { "success": true }
  },
  "message": "Sync completed"
}
```

**Error Response**:
```json
{
  "success": false,
  "results": {
    "teachers": { "success": false, "error": "Network error" },
    "talks": { "success": true }
  },
  "message": "Sync completed"
}
```

**Status Codes**:
- `200` - Success (all operations succeeded)
- `405` - Method not allowed (only GET supported)
- `500` - Server error (one or more operations failed)

### Event Tracking API

**Endpoint**: `POST /api/event`

Tracks analytics events (proxies to Plausible).

**Body**:
```json
{
  "event": "play",
  "url": "https://dharmarad.io/talks/some-talk",
  "props": {
    "talk_id": "123"
  }
}
```

**Response**: `200 OK`

## Utility Functions

### Pagination

**File**: `app/utils/pagination.server.ts`

#### withPagination

Adds pagination to Drizzle queries with total count.

**Usage**:
```typescript
import { withPagination, totalCountField } from "~/utils/pagination.server";

const query = db
  .select({
    ...talks,
    ...totalCountField, // Required for total count
  })
  .from(talks);

const result = await withPagination({
  query: query.$dynamic(),
  params: { page: 1, perPage: 20 },
});

// Returns:
// {
//   items: [...],
//   pagination: {
//     total: 1000,
//     pages: 50,
//     current: 1
//   }
// }
```

**Parameters**:
- `query` - Drizzle query (must include `totalCountField`)
- `params.page` - Page number (default: 1)
- `params.perPage` - Items per page (default: 20)

**Returns**:
```typescript
{
  items: T[],
  pagination: {
    total: number,
    pages: number,
    current: number
  }
}
```

### Request Params

**File**: `app/utils/request-params.ts`

#### getRequestParams

Parses URL search params for filtering, sorting, and pagination.

**Usage**:
```typescript
import { getRequestParams } from "~/utils/request-params";

const { searchQuery, page, sort, hasSearch } = getRequestParams(request, {
  field: "date",
  order: "desc"
});

// Returns:
// {
//   searchQuery: string,
//   page: number,
//   sort: { field: string, order: "asc" | "desc" },
//   hasSearch: boolean
// }
```

**Parameters**:
- `request` - Remix Request object
- `defaultSort` - Default sort configuration
  - `field` - Default sort field
  - `order` - Default sort order ("asc" or "desc")

**URL Examples**:
```
?search=meditation → searchQuery: "meditation"
?page=2 → page: 2
?sort=title-asc → sort: { field: "title", order: "asc" }
?sort=date-desc → sort: { field: "date", order: "desc" }
```

### Ordering

**File**: `app/utils/with-ordering.ts`

#### withOrdering

Type-safe ordering helper for Drizzle queries.

**Usage**:
```typescript
import { withOrdering } from "~/utils/with-ordering";
import { asc, desc } from "drizzle-orm";

const ordering = withOrdering({
  field: "date",
  order: "desc",
  config: {
    title: { column: talks.title },
    duration: { column: talks.duration },
    date: { column: talks.publicationDate },
  },
});

const query = db
  .select()
  .from(talks)
  .orderBy(ordering);
```

**Parameters**:
- `field` - Field to sort by
- `order` - Sort order ("asc" or "desc")
- `config` - Map of field names to columns

**Returns**: Drizzle ordering function (asc/desc)

### Search Params

**File**: `app/utils/search-params.ts`

#### useSearchParamState

Client-side hook for managing search params.

**Usage**:
```typescript
import { useSearchParamState } from "~/utils/search-params";

function SearchComponent() {
  const [search, setSearch] = useSearchParamState("search");

  return (
    <input
      value={search || ""}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
}
```

### Database Client

**File**: `app/db/client.server.ts`

#### db

Creates Drizzle database instance.

**Usage**:
```typescript
import { db } from "~/db/client.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const database = db(context.cloudflare.env.DB);

  const talks = await database
    .select()
    .from(talks);

  return json(talks);
}
```

### Sync Utilities

**File**: `app/sync/lib/`

#### Logger

Structured logging utility.

**Usage**:
```typescript
import { Logger } from "~/sync/lib/logger";

const logger = new Logger("my-operation");

logger.info("Starting operation");
logger.debug("Processing item", { id: 123 });
logger.error("Operation failed", error);
```

#### Retry

Retry with exponential backoff.

**Usage**:
```typescript
import { withRetry } from "~/sync/lib/retry";

const data = await withRetry(
  async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
  }
);
```

#### Batch

Process arrays in batches.

**Usage**:
```typescript
import { batch } from "~/sync/lib/batch";

const items = [...]; // Large array

await batch(items, async (chunk) => {
  await db.insert(table).values(chunk);
}, 50); // 50 items per batch
```

#### Parse HTML

Parse HTML in any environment.

**Usage**:
```typescript
import { parseHtml } from "~/sync/lib/parse-html";

const doc = parseHtml(htmlString);
const title = doc.querySelector("h1")?.textContent;
```

#### Slugify

Create URL-friendly slugs.

**Usage**:
```typescript
import { slugify } from "~/sync/lib/utils";

const slug = slugify("Teacher Name", 123);
// Result: "teacher-name-123"
```

## Cache Headers

**File**: Uses `pretty-cache-header` package

**Usage in routes**:
```typescript
import { cacheHeader } from "pretty-cache-header";

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",          // Browser cache
    sMaxage: "24hours",        // CDN cache
    staleWhileRevalidate: "1week", // Serve stale while revalidating
  }),
};
```

**Time Units**:
- `"5min"` - 5 minutes
- `"2hours"` - 2 hours
- `"1day"` - 1 day
- `"1week"` - 1 week

## Analytics

### Plausible

**File**: `app/utils/plausible.ts`

#### trackPlausibleEvent

Track custom events.

**Usage**:
```typescript
import { trackPlausibleEvent } from "~/utils/plausible";

trackPlausibleEvent({
  event: "play",
  url: window.location.href,
  props: {
    talk_id: "123",
    teacher: "John Doe",
  },
});
```

### PostHog

**File**: Uses `posthog-js` package

**Usage**:
```typescript
import { usePostHog } from "posthog-js/react";

function Component() {
  const posthog = usePostHog();

  const handleClick = () => {
    posthog?.capture("button_clicked", {
      button_name: "play",
    });
  };
}
```

## Database Schema Types

**File**: `app/db/schema.ts`

Import types from schema:

```typescript
import { teachers, talks, centers, retreats } from "~/db/schema";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Select types (from database)
type Teacher = InferSelectModel<typeof teachers>;
type Talk = InferSelectModel<typeof talks>;
type Center = InferSelectModel<typeof centers>;
type Retreat = InferSelectModel<typeof retreats>;

// Insert types (for inserts)
type NewTeacher = InferInsertModel<typeof teachers>;
type NewTalk = InferInsertModel<typeof talks>;
```

## Rate Limiting (Future)

Example implementation:

```typescript
// app/utils/rate-limit.server.ts
export class RateLimiter {
  private requests = new Map<string, number[]>();

  check(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests
    const validRequests = requests.filter(
      (time) => now - time < window * 1000
    );

    if (validRequests.length >= limit) {
      return false; // Rate limit exceeded
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }
}

// Usage in loader
export async function loader({ request }: LoaderFunctionArgs) {
  const ip = request.headers.get("CF-Connecting-IP");
  const limiter = new RateLimiter();

  if (!limiter.check(ip, 100, 60)) {
    throw new Response("Too many requests", { status: 429 });
  }

  // ... rest of loader
}
```

## Error Handling

Standard error responses:

```typescript
// 400 Bad Request
throw new Response("Invalid parameters", { status: 400 });

// 404 Not Found
throw new Response("Not found", { status: 404 });

// 429 Too Many Requests
throw new Response("Rate limit exceeded", { status: 429 });

// 500 Internal Server Error
throw new Response("Server error", { status: 500 });
```

With JSON:

```typescript
throw json(
  { error: "Invalid parameters", details: "..." },
  { status: 400 }
);
```

## Next Steps

- [Database Guide](./database.md) - Schema and queries
- [Data Sync](./data-sync.md) - Sync API details
- [Routing & Loaders](./routing-loaders.md) - Using APIs in routes
