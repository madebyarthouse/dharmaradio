# AI Agents Guide

This document describes the AI agents and automation workflows in the Dharma Radio project.

## Overview

Dharma Radio uses automated agents for data synchronization and processing. These agents run on Cloudflare Workers with scheduled cron jobs and can be triggered manually via API endpoints.

## Data Sync Agents

### Teacher Sync Agent

**Location**: `app/sync/sync-teachers.ts`

**Purpose**: Fetches and synchronizes teacher profiles from dharmaseed.org

**How it works**:
1. Fetches paginated list of teachers (100 per page)
2. Parses HTML to extract teacher metadata
3. Upserts teachers into D1 database (conflict handling on dharmaSeedId)
4. Updates existing records, inserts new ones

**Key features**:
- Retry logic with exponential backoff (3 attempts, max 10s delay)
- Structured logging for observability
- Batch processing with 1s delay between pages
- Slug generation from teacher name + ID

**Manual trigger**: `GET /api/sync?command=teachers`

### Talk Sync Agent

**Location**: `app/sync/sync-to-db.ts`

**Purpose**: Fetches and synchronizes dharma talks with all relationships

**How it works**:
1. Fetches all teachers from database
2. For each teacher, fetches their talks from dharmaseed.org RSS feeds
3. Enriches talk data by fetching retreat and center information
4. Batch inserts talks into database (50 at a time)
5. Updates relationships (teacher, center, retreat)

**Key features**:
- Parallel processing with configurable concurrency
- HTML scraping for additional metadata (retreat, center)
- Retry logic on all network requests
- Batch processing for efficient database operations
- Skip processing flag for faster sync (`skipProcessing=true`)

**Manual trigger**:
- `GET /api/sync?command=talks`
- `GET /api/sync?command=talks&skipProcessing=true`

### Full Sync Agent

**Location**: `app/routes/api.sync.ts`

**Purpose**: Orchestrates complete data synchronization

**How it works**:
1. Syncs teachers first
2. Then syncs talks (which depend on teachers)
3. Returns detailed results for each operation
4. Continues even if one operation fails (reports all results)

**Manual trigger**: `GET /api/sync` or `GET /api/sync?command=all`

## Scheduling

**Cron Configuration** (`wrangler.toml`):
```
crons=["0 */6 * * *"]  # Every 6 hours
```

The full sync agent runs automatically every 6 hours to keep data fresh.

## Utility Agents

### HTML Parser (`app/sync/lib/parse-html.ts`)
- Parses HTML using jsdom (Node.js) or linkedom (Cloudflare Workers)
- Extracts structured data from dharmaseed.org pages

### Retry Handler (`app/sync/lib/retry.ts`)
- Implements exponential backoff with jitter
- Configurable max attempts and delay
- Used by all network operations

### Logger (`app/sync/lib/logger.ts`)
- Structured logging with context
- Supports info, debug, error levels
- Includes timing and metadata

### Batch Processor (`app/sync/lib/batch.ts`)
- Processes large datasets in chunks
- Configurable batch size
- Memory efficient for large syncs

## Error Handling

All agents include:
- Try-catch blocks around critical operations
- Structured error logging with context
- Graceful degradation (continues on non-fatal errors)
- Retry logic for transient failures
- HTTP error status codes in API responses

## Monitoring & Observability

**Logs**: All agents use structured logging with:
- Operation name (e.g., "sync-teachers")
- Timing information (duration)
- Record counts
- Error details with stack traces

**API Response Format**:
```json
{
  "success": true/false,
  "results": {
    "teachers": { "success": true },
    "talks": { "success": true }
  },
  "message": "Sync completed"
}
```

## Development Tips

### Testing Sync Locally

1. Ensure local D1 database is initialized:
   ```bash
   pnpm d1:init:local
   ```

2. Start dev server:
   ```bash
   pnpm dev
   ```

3. Trigger sync via curl:
   ```bash
   curl http://127.0.0.1:8788/api/sync?command=teachers
   curl http://127.0.0.1:8788/api/sync?command=talks&skipProcessing=true
   ```

### Adding New Sync Agents

1. Create new file in `app/sync/`
2. Implement main sync function with D1Database parameter
3. Add to `api.sync.ts` switch statement
4. Include retry logic and structured logging
5. Use batch processing for large datasets
6. Test locally before deploying

### Performance Optimization

- Use `skipProcessing=true` for faster initial sync
- Adjust batch sizes in `batch.ts` (default: 50)
- Configure retry delays in `retry.ts`
- Add indexes to schema for new query patterns
- Monitor D1 query performance in Wrangler logs

## Future Agent Ideas

Based on `.cursorrules`, planned future agents:

1. **Audio File Sync Agent**: Sync audio files to Cloudflare R2 for CDN delivery
2. **Transcription Agent**: Use AI to transcribe dharma talks
3. **Analysis Agent**: Analyze talk content and generate metadata
4. **RSS Feed Generator**: Create custom RSS feeds for users
5. **Playlist Curator**: Generate personalized playlists based on listening history
