# AI Agents Guide

This repository runs on a single Cloudflare Worker. Agents in this project are scheduled Worker jobs and local maintenance scripts, not public API endpoints.

## Overview

Dharma Radio scrapes and indexes talks from dharmaseed.org into Cloudflare D1, caches query results in KV, and serves the application through a React Router 7 Worker runtime.

Current architecture:

- One Worker entry: `workers/app.ts`
- Scheduled jobs dispatch through `scheduled()`
- Cron mapping lives in `app/cron/jobs.ts`
- Shared sync orchestration lives in `app/sync/run-sync.ts`
- D1 is the source of truth
- KV is cache only
- `process.env` is used only for string configuration under `nodejs_compat`

Not part of the architecture:

- No `/api/sync` route
- No second “sync worker”
- No Queues
- No Workflows

## Active Agents

### Teacher Sync Agent

Location: `app/sync/sync-teachers.ts`

Purpose:

- Fetches and upserts teacher records from dharmaseed.org into D1

Execution path:

1. `workers/app.ts` receives a scheduled event
2. `app/cron/jobs.ts` maps cron to `syncTeachers`
3. `app/sync/run-sync.ts` runs the job and persists a `sync_runs` record
4. Cache epoch is bumped on success

Schedule:

- `0 3 * * *`

### Talk Sync Agent

Location: `app/sync/sync-to-db.ts`

Purpose:

- Fetches and upserts talks plus teacher, center, and retreat relationships

Execution path:

1. `workers/app.ts` receives a scheduled event
2. `app/cron/jobs.ts` maps cron to `syncTalks`
3. `app/sync/run-sync.ts` runs the job and persists a `sync_runs` record
4. Cache epoch is bumped on success

Schedule:

- `0 */6 * * *`

## Sync Bookkeeping

Location: `app/db/schema.ts`

`sync_runs` records every scheduled execution with:

- `job`
- `status`
- `started_at`
- `finished_at`
- `duration_ms`
- `processed_count`
- `failed_count`
- `meta_json`

If you add a new scheduled job, it must write through `run-sync.ts` so `sync_runs` stays authoritative.

## Caching

### Edge Cache

Location: `workers/app.ts`

- GET-only SSR cache
- Versioned via `CF_VERSION_METADATA`
- Respects `Cache-Control`, `Authorization`, `Set-Cookie`, and `Vary: *`

### KV Query Cache

Location: `app/lib/cache.server.ts`

- Binding: `DB_QUERY_CACHE`
- Used for expensive derived/query payloads
- Invalidated by cache epoch bump after successful syncs

## Local Maintenance Scripts

These are the manual operator entrypoints. Manual sync does not happen over HTTP.

### Remote D1 to Local D1

Location: `scripts/db-import-remote-to-local.ts`

Command:

```bash
pnpm run db:import:remote-to-local
```

Behavior:

- Confirms before deleting local D1 state unless `--yes`
- Exports remote D1 to SQL
- Imports the dump into local D1

### Local D1 to Remote D1

Location: `scripts/db-import-local-to-remote.ts`

Command:

```bash
pnpm run db:import:local-to-remote
```

Behavior:

- Confirms before overwriting remote D1 unless `--yes`
- Exports local D1 to SQL
- Imports the dump into remote D1

### Missing Data Backfill

Location: `scripts/backfill-missing-production-data.ts`

Command:

```bash
pnpm run data:backfill:missing -- --dry-run --teachers --talks
```

Useful flags:

- `--dry-run`
- `--teachers`
- `--talks`
- `--limit=<n>`

Behavior:

- Runs locally against local D1 only
- Repairs missing derived fields by rescraping dharmaseed.org
- Fetches talk listing pages concurrently
- Separates retreat discovery from core missing-field repair
- Uses `chalk` and `ora` for progress and summaries

## Development Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm run d1:init:local
pnpm run db:migrate
pnpm run db:migrate:remote
```

## Rules For Agents

### Runtime Rules

- Do not reintroduce `/api/sync`
- Do not add a second Worker for cron
- Keep scheduled jobs inside `workers/app.ts`
- Keep cron definitions in sync between `wrangler.jsonc` and `app/cron/jobs.ts`

### Database Rules

- D1 is canonical storage
- KV is cache only
- Change `app/db/schema.ts` first, then run `pnpm run db:generate`
- Do not handwrite migrations

### Config Rules

- Use `process.env` only for string config/secrets
- Use Worker bindings for platform resources:
  - `env.DB`
  - `env.DB_QUERY_CACHE`
  - `env.CF_VERSION_METADATA`

### Local Ops Rules

- Backfill changes should stay local-first
- Remote writes should happen only through the explicit import script
- Prefer `--dry-run` first for backfill work

## Future Agent Work

If new automation is added, follow the same shape:

1. Add the scheduled mapping in `app/cron/jobs.ts`
2. Route execution through `app/sync/run-sync.ts` or an equivalent shared runner
3. Persist operational metadata to D1
4. Invalidate cache deliberately
5. Do not expose the job as a public route unless there is a strong product reason
