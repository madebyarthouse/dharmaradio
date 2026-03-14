# Data Sync Guide

This guide explains how Dharma Radio synchronizes data from dharmaseed.org.

## Overview

The sync system scrapes data from dharmaseed.org's HTML pages and RSS feeds, transforms it, and stores it in the D1 database. It runs automatically every 6 hours via cron jobs.

## Architecture

```
dharmaseed.org
    ↓
Fetch (HTTP)
    ↓
Parse (HTML/RSS)
    ↓
Transform
    ↓
Batch Insert/Update
    ↓
D1 Database
```

## Sync Agents

### 1. Teacher Sync

**File**: `app/sync/sync-teachers.ts`

**What it does**:
- Fetches teacher list from dharmaseed.org (paginated, 100/page)
- Parses HTML to extract teacher profiles
- Upserts to database (updates existing, inserts new)

**Trigger**:
```bash
curl http://127.0.0.1:8788/api/sync?command=teachers
```

**Flow**:
```typescript
1. fetchTeachersListFromDharmaseed()
   ├─> Fetch page 1 with 100 items
   ├─> Parse HTML → extract teachers
   ├─> Continue until empty page
   └─> Return all teachers

2. For each teacher:
   ├─> Generate slug from name + ID
   ├─> Upsert to database
   │   └─> On conflict (dharmaSeedId): update
   └─> Log result
```

**Data extracted**:
- Name
- Description (bio)
- Profile image URL
- Website URL
- Donation URL
- DharmaSeed ID

### 2. Talk Sync

**File**: `app/sync/sync-to-db.ts`

**What it does**:
- Fetches all teachers from database
- For each teacher, fetches their talks RSS feed
- Enriches talk data with retreat/center info
- Batch inserts talks to database

**Trigger**:
```bash
curl http://127.0.0.1:8788/api/sync?command=talks

# Faster (skip extra processing)
curl http://127.0.0.1:8788/api/sync?command=talks&skipProcessing=true
```

**Flow**:
```typescript
1. Get all teachers from database

2. For each teacher:
   ├─> fetchTalksForTeacher(teacherId)
   │   ├─> Fetch RSS feed
   │   ├─> Parse XML
   │   └─> Extract talk metadata

3. For each talk (if !skipProcessing):
   ├─> fetchTalkPage(talkUrl)
   │   └─> Extract retreat/center info
   └─> Enrich talk data

4. Batch insert talks (50 per batch):
   ├─> Generate slug from title + ID
   ├─> Insert with foreign keys
   └─> Log result
```

**Data extracted**:
- Title
- Description
- Audio URL
- Duration
- Publication date
- External GUID
- Teacher ID
- Center ID (if available)
- Retreat ID (if available)

### 3. Full Sync

**File**: `app/routes/api.sync.ts`

**What it does**:
- Orchestrates teacher + talk sync
- Runs teachers first (talks depend on them)
- Returns detailed results

**Trigger**:
```bash
curl http://127.0.0.1:8788/api/sync
# or
curl http://127.0.0.1:8788/api/sync?command=all
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

## Utility Functions

### HTML Parser (`app/sync/lib/parse-html.ts`)

Parses HTML using different libraries depending on environment:
- **Node.js** (dev): jsdom (full DOM implementation)
- **Cloudflare Workers** (prod): linkedom (lightweight DOM)

```typescript
import { parseHtml } from "./parse-html";

const doc = parseHtml(htmlString);
const title = doc.querySelector("h1")?.textContent;
```

### Retry Handler (`app/sync/lib/retry.ts`)

Implements exponential backoff with jitter for resilient network requests:

```typescript
import { withRetry } from "./retry";

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

**Algorithm**:
1. Try request
2. If fails: wait `delay = min(initialDelay * 2^attempt, maxDelay)`
3. Add random jitter: `delay * (0.5 + random(0.5))`
4. Retry up to maxAttempts

### Logger (`app/sync/lib/logger.ts`)

Structured logging for observability:

```typescript
import { Logger } from "./logger";

const logger = new Logger("sync-teachers");

logger.info("Starting sync");
logger.debug("Processing teacher", { name: "John Doe" });
logger.error("Sync failed", error);
```

**Log format**:
```
[sync-teachers] INFO: Starting sync
[sync-teachers] DEBUG: Processing teacher { name: "John Doe" }
[sync-teachers] ERROR: Sync failed Error: ...
```

### Batch Processor (`app/sync/lib/batch.ts`)

Process large arrays in chunks:

```typescript
import { batch } from "./batch";

const talks = [...]; // 5000 items

await batch(talks, async (chunk) => {
  await db.insert(talks).values(chunk);
}, 50); // Process 50 at a time
```

## Scheduling

### Cron Configuration

**File**: `wrangler.toml`

```toml
[triggers]
crons=["0 */6 * * *"]  # Every 6 hours
```

This automatically calls the sync endpoint every 6 hours.

### Manual Trigger

For development/testing:

```bash
# Full sync
curl http://127.0.0.1:8788/api/sync

# Teachers only
curl http://127.0.0.1:8788/api/sync?command=teachers

# Talks only (fast)
curl http://127.0.0.1:8788/api/sync?command=talks&skipProcessing=true
```

## Error Handling

### Retry Logic

All fetch operations use retry with exponential backoff:

```typescript
const response = await withRetry(
  async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res;
  },
  {
    maxAttempts: 3,
    initialDelay: 3000,
    maxDelay: 10000,
  }
);
```

### Error Recovery

```typescript
try {
  await syncTeachers(db);
  results.teachers = { success: true };
} catch (error) {
  results.teachers = {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error"
  };
}

// Continue with talks even if teachers failed
try {
  await syncTalks(db, skipProcessing);
  results.talks = { success: true };
} catch (error) {
  results.talks = { success: false, error: error.message };
}
```

### Logging

All errors are logged with context:

```typescript
try {
  // ... operation
} catch (error) {
  logger.error(`Failed to process teacher ${teacher.name}`, error as Error);
}
```

## Performance Optimization

### Parallel Processing

Teachers are processed sequentially, but network requests within each operation can be parallelized in the future.

### Batch Operations

Database inserts use batching (50 items per batch) to reduce round trips:

```typescript
await batch(talks, async (chunk) => {
  await db.insert(talks).values(chunk);
}, 50);
```

### Rate Limiting

Delays between pages prevent overwhelming the source server:

```typescript
await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
```

### Skip Processing

The `skipProcessing` flag skips expensive page scraping:

```bash
# Fast sync (skips retreat/center enrichment)
curl http://127.0.0.1:8788/api/sync?command=talks&skipProcessing=true
```

## Data Transformation

### Slug Generation

Creates URL-friendly slugs:

```typescript
import { slugify } from "./lib/utils";

const slug = slugify("Teacher Name", 123);
// Result: "teacher-name-123"
```

**Algorithm**:
1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove special characters
4. Append ID for uniqueness

### Date Parsing

Handles various date formats from dharmaseed.org:

```typescript
const publicationDate = new Date(item.pubDate);
```

### URL Extraction

Extracts clean URLs from HTML:

```typescript
const audioUrl = item.enclosure?.[0]?.["$"]?.url;
const profileImageUrl = doc.querySelector("img.teacher-photo")?.src;
```

## Testing

### Local Testing

1. Start dev server:
   ```bash
   pnpm dev
   ```

2. Trigger sync:
   ```bash
   curl http://127.0.0.1:8788/api/sync?command=teachers
   ```

3. Check logs in terminal

4. Verify data in Drizzle Studio:
   ```bash
   pnpm drizzle:studio
   ```

### Testing Individual Functions

Use Node.js REPL or create test script:

```typescript
// test-sync.ts
import { fetchTeachersListFromDharmaseed } from "./app/sync/lib/fetch-teachers-list";

const teachers = await fetchTeachersListFromDharmaseed();
console.log(`Found ${teachers.length} teachers`);
```

Run:
```bash
npx tsx test-sync.ts
```

## Monitoring

### Sync Logs

Check Cloudflare Workers logs:
1. Go to Cloudflare dashboard
2. Navigate to Workers & Pages
3. Select your deployment
4. View logs

### Metrics to Monitor

- Sync duration (see logs)
- Number of records processed
- Error rate
- Database size
- API response times

### Alerts

Set up alerts for:
- Sync failures (via Cloudflare)
- Long sync duration (>1 hour)
- Database errors
- High error rates

## Troubleshooting

### Sync Takes Too Long

- Use `skipProcessing=true` flag
- Increase batch size (carefully)
- Check network latency
- Verify source site is responsive

### Missing Data

- Check HTML parsing logic
- Verify source HTML structure hasn't changed
- Check for failed requests in logs
- Run sync again (may be transient failure)

### Database Conflicts

- Check unique constraints (slug, dharmaSeedId)
- Verify upsert logic in sync functions
- Check for duplicate data in source

### Rate Limiting

If getting 429 errors from dharmaseed.org:
- Increase delay between requests
- Reduce concurrent requests
- Contact dharmaseed.org for permission

## Future Improvements

1. **Incremental Sync**: Only sync changed data
2. **Parallel Processing**: Process multiple teachers at once
3. **Delta Detection**: Track changes and only update modified records
4. **Webhooks**: Real-time sync on data changes
5. **Validation**: Schema validation before database insert
6. **Deduplicate**: Check for duplicate data before insert
7. **Audio CDN**: Sync audio files to R2 for CDN delivery

## Related Files

- `app/sync/sync-teachers.ts` - Teacher sync agent
- `app/sync/sync-to-db.ts` - Talk sync agent
- `app/sync/lib/fetch-teachers-list.ts` - Teacher list fetcher
- `app/sync/lib/fetch-talks.ts` - Talk fetcher
- `app/sync/lib/parse-*.ts` - HTML parsers
- `app/sync/lib/retry.ts` - Retry logic
- `app/sync/lib/logger.ts` - Logging utility
- `app/sync/lib/batch.ts` - Batch processor
- `app/routes/api.sync.ts` - Sync API endpoint

## Next Steps

- [Database Guide](./database.md) - Understanding the schema
- [Architecture](./architecture.md) - System overview
- [API Reference](./api-reference.md) - API documentation
