# CLAUDE.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Dharma Radio is a Cloudflare Worker application built with React Router 7. It scrapes and indexes dharmaseed.org content into Cloudflare D1, caches expensive reads in KV, and serves a browsable audio experience for talks, teachers, centers, and retreats.

This is no longer a Remix Pages app and no longer uses a manual sync API route.

Current runtime shape:

- React Router 7 framework mode
- One Cloudflare Worker entry at `workers/app.ts`
- Scheduled sync jobs via `scheduled()`
- D1 for canonical data
- KV for cache
- `nodejs_compat` plus `nodejs_compat_populate_process_env`

## Core Commands

### Development

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
```

### Database

```bash
pnpm run d1:init:local
pnpm run db:generate
pnpm run db:migrate
pnpm run db:migrate:remote
pnpm run db:studio
```

### Local Data Operations

```bash
pnpm run db:import:remote-to-local
pnpm run db:import:local-to-remote
pnpm run data:backfill:missing -- --dry-run --teachers --talks
```

## Non-Negotiable Rules

### Do Not Reintroduce Old Architecture

- No `/api/sync`
- No separate sync worker
- No manual cron-via-HTTP flow
- No Queues or Workflows unless explicitly requested

Scheduled jobs must stay in-process:

1. `workers/app.ts`
2. `app/cron/jobs.ts`
3. `app/sync/run-sync.ts`

### Migration Rule

When the schema changes:

1. Update `app/db/schema.ts`
2. Run `pnpm run db:generate`
3. Review the generated output

Do not handwrite migrations.

### Binding Rule

Use Worker bindings for platform resources:

- `env.DB`
- `env.DB_QUERY_CACHE`
- `env.CF_VERSION_METADATA`

Use `process.env` only for string configuration or secrets.

## Important Files

### Worker Runtime

- `workers/app.ts`
- `wrangler.jsonc`
- `react-router.config.ts`
- `vite.config.ts`

`workers/app.ts` is responsible for:

- request handling
- SSR edge caching
- scheduled cron dispatch

If cron schedules change, update both:

- `wrangler.jsonc`
- `app/cron/jobs.ts`

### Sync System

- `app/cron/jobs.ts`
- `app/sync/run-sync.ts`
- `app/sync/sync-teachers.ts`
- `app/sync/sync-to-db.ts`
- `app/sync/lib/parse-html.ts`
- `app/sync/lib/retry.ts`
- `app/sync/lib/logger.ts`

`run-sync.ts` persists `sync_runs` and bumps the KV cache epoch after successful runs. New sync jobs should follow that same pattern.

### Data Layer

- `app/db/schema.ts`
- `app/db/client.server.ts`
- `app/lib/cache.server.ts`

Main entities:

- `teachers`
- `talks`
- `centers`
- `retreats`
- `sync_runs`

## Caching Model

### Edge Cache

In `workers/app.ts`:

- GET-only
- versioned by `CF_VERSION_METADATA`
- bypassed for auth/no-cache/private responses

### KV Query Cache

In `app/lib/cache.server.ts`:

- used for expensive derived payloads
- invalidated by cache epoch
- never used as source of truth

## Local Data Repair Workflow

The supported manual repair flow is local-first:

1. `pnpm run db:import:remote-to-local`
2. `pnpm run data:backfill:missing -- --dry-run ...`
3. run the real local backfill once satisfied
4. optionally `pnpm run db:import:local-to-remote`

The backfill script:

- runs locally only
- fetches talk pages concurrently
- separates retreat discovery from ordinary missing-field repair
- logs progress with `chalk` and `ora`
- should remain safe to dry-run by default

## Frontend Notes

The UI should preserve the spirit of the existing product:

- no redesign-by-default
- keep route behavior stable
- keep the audio player behavior stable
- preserve SEO and collection pages

Libraries in use include:

- React 19
- React Router 7
- Tailwind CSS 4
- Radix UI
- `motion`

## Operational Notes

- `wrangler.jsonc` currently expects real KV namespace IDs before production deploy
- Local development uses Wrangler-backed D1
- `sync_runs` is the operational history table for scheduled syncs

## When Changing Sync Logic

Prefer this sequence:

1. confirm whether the change belongs in teacher sync, talk sync, or backfill
2. keep parsing logic in `app/sync/lib/parse-html.ts` or adjacent `lib/` utilities
3. keep orchestration in `run-sync.ts`
4. preserve `sync_runs` persistence
5. preserve cache invalidation after successful scheduled jobs

If you need a new maintenance workflow, prefer a local script in `scripts/` over a public HTTP endpoint.
