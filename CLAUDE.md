# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dharma Radio is a Remix-based web application that scrapes and indexes dharma talks from dharmaseed.org, providing a modern podcast-style player interface. The project uses Cloudflare Pages/Workers for hosting, D1 for the database, and features browsable collections of teachers, centers, talks, and retreats with an integrated audio player.

## Technology Stack

- **Framework**: Remix (v2) with Cloudflare Pages/Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Styling**: TailwindCSS with Radix UI components
- **Package Manager**: pnpm
- **Language**: TypeScript (strict mode, no `any` types)

## Common Commands

### Development
```bash
pnpm dev                    # Start Remix dev server with Wrangler (http://127.0.0.1:8788)
pnpm typecheck              # Run TypeScript type checking
pnpm lint                   # Run ESLint
pnpm format                 # Format code with Prettier
```

### Database Management
```bash
pnpm drizzle:studio         # Open Drizzle Studio for database inspection
pnpm drizzle:update         # Generate new migrations from schema changes
pnpm drizzle:migrate:local  # Apply migrations to local D1 database
pnpm drizzle:migrate:remote # Apply migrations to remote D1 database
pnpm d1:init:local          # Initialize local database with fixture data
```

### Build & Deploy
```bash
pnpm build                  # Build for production
pnpm start                  # Start local Wrangler server with production build
```

### Data Sync
The sync API endpoint (`/api/sync`) triggers data scraping:
- `/api/sync?command=teachers` - Sync only teachers
- `/api/sync?command=talks` - Sync only talks
- `/api/sync?command=all` - Sync everything (default)
- Add `&skipProcessing=true` to skip processing step

## Architecture

### Database Schema (`app/db/schema.ts`)

Four main entities with Drizzle ORM relations:
- **teachers**: Buddhist teachers with profiles (linked via dharmaSeedId)
- **talks**: Individual dharma talks (audio files with metadata)
- **centers**: Meditation centers/organizations
- **retreats**: Multi-day retreat events

Key relationships:
- talks → teachers (many-to-one, required)
- talks → centers (many-to-one, optional)
- talks → retreats (many-to-one, optional)

All tables include comprehensive indexes for search, sorting, and filtering. See schema for compound indexes on common query patterns.

### Routing & Data Loading

Remix file-based routing with loader pattern:
- Data fetching in `loader` functions (server-side)
- All business logic (filtering, sorting, pagination) in loaders
- Use `cacheHeader` from `pretty-cache-header` with sMaxage and staleWhileRevalidate
- Route naming: `[filename].tsx` for special routes, `_.$slug.tsx` for dynamic params

Example loader pattern (see `app/routes/talks.tsx`):
1. Parse request params with `getRequestParams` (search, page, sort)
2. Build Drizzle query with joins and filters
3. Apply ordering with `withOrdering` helper
4. Apply pagination with `withPagination` helper (includes total count via window function)

### Data Sync System (`app/sync/`)

Scrapes data from dharmaseed.org using HTML parsing:
- `sync-teachers.ts` - Fetches and syncs teacher profiles (paginated)
- `sync-to-db.ts` - Fetches and syncs talks with all relationships
- `lib/fetch-*.ts` - Individual fetch operations with retry logic
- `lib/parse-*.ts` - HTML parsing with jsdom/linkedom
- `lib/batch.ts` - Batch processing for large datasets
- `lib/retry.ts` - Retry logic with exponential backoff
- `lib/logger.ts` - Structured logging utility

Triggered via:
1. Cron job (every 6 hours, see `wrangler.toml`)
2. Manual API call to `/api/sync`

### Audio Player (`app/contexts/audio-context.tsx`)

Global audio context provider managing:
- Current talk playback state
- Play/pause controls
- Seek functionality
- Progress tracking
- Plausible analytics events

The player persists across route navigation. Used via `useAudio()` hook in components.

### Pagination & Filtering

Centralized utilities in `app/utils/`:
- `pagination.server.ts` - Window function-based pagination with `withPagination` helper
- `with-ordering.ts` - Type-safe ordering helper for Drizzle queries
- `request-params.ts` - Parse search, sort, and page params from URL
- `search-params.ts` - Client-side search param helpers

Pattern: Add `totalCountField` to query select, use `withPagination` to get items + pagination metadata.

### Component Structure

- `app/components/` - Feature components (Player, Navbar, cards)
- `app/components/ui/` - Reusable UI components (search-input, pagination, tabs, filterable-list)
- All components use functional style (no `React.FC`)
- Prop types inlined when used once
- Loading and error states for data fetching
- Responsive design with mobile-first Tailwind

## Development Guidelines

### TypeScript
- Use `type` over `interface`
- Object params for functions (except single param)
- kebab-case for files/folders, camelCase for functions/variables, PascalCase for components
- No `any` types - use proper typing
- Avoid enums, use maps or union types

### React
- Functional components only
- No `React.FC`
- Keep components clean (minimal boilerplate)
- Always include loading/error states
- Use Error Boundaries in Remix

### Styling
- TailwindCSS with mobile-first approach
- Use `clsx` for conditional classes
- Radix UI for accessible components

### Accessibility
- Semantic HTML elements
- Keyboard navigation support
- ARIA roles/attributes where needed
- Focus states for interactive elements
- Sufficient color contrast

### Caching
- Always set cache headers in route `headers` export
- Use `sMaxage` and `staleWhileRevalidate` for Cloudflare CDN
- Example: `maxAge: "6hours", sMaxage: "24hours", staleWhileRevalidate: "1week"`

## Important Notes

- Environment variables for Drizzle require `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`
- Local D1 database binding: `env.DB` (see `wrangler.toml`)
- Cron triggers configured for every 6 hours
- Node version: >=18.0.0 (see `.node-version`)
- Never commit `.dev.vars` or `.env` files
- All sync operations include retry logic and structured logging
- The project uses Wrangler for local development (emulates Cloudflare runtime)
