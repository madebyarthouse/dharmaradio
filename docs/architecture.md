# Architecture Overview

This document provides a high-level overview of Dharma Radio's architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                        │
│              (Edge Caching & Distribution)               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Cloudflare Pages/Workers                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │            Remix Application                    │    │
│  │  ┌──────────────┐        ┌──────────────┐     │    │
│  │  │   Routes     │───────▶│   Loaders    │     │    │
│  │  │  (UI Pages)  │        │ (Data Fetch) │     │    │
│  │  └──────────────┘        └──────┬───────┘     │    │
│  │                                  │              │    │
│  │  ┌──────────────┐               │              │    │
│  │  │  Components  │◀──────────────┘              │    │
│  │  │  (React UI)  │                              │    │
│  │  └──────────────┘                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Sync Agents (Cron: Every 6hrs)        │    │
│  │  ┌──────────────┐        ┌──────────────┐     │    │
│  │  │   Teachers   │        │    Talks     │     │    │
│  │  │     Sync     │───────▶│    Sync      │     │    │
│  │  └──────────────┘        └──────────────┘     │    │
│  └────────────────────────────────────────────────┘    │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                ┌─────────▼──────────┐
                │   Cloudflare D1    │
                │  (SQLite Database) │
                └─────────┬──────────┘
                          │
            ┌─────────────▼──────────────┐
            │     External Source        │
            │    dharmaseed.org          │
            │    (HTML Scraping)         │
            └────────────────────────────┘
```

## Key Components

### 1. Remix Application Layer

**Purpose**: Server-side rendered React application with client-side hydration

**Key Features**:
- File-based routing (`app/routes/`)
- Server-side data loading via `loader` functions
- Progressive enhancement
- Automatic code splitting
- Client-side navigation

**Tech Stack**:
- React 18 (functional components)
- Remix v2 (full-stack framework)
- TailwindCSS (styling)
- Radix UI (accessible components)

### 2. Data Layer

**Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM for type-safe queries
- **Schema**: Four main tables (teachers, talks, centers, retreats)
- **Indexes**: Comprehensive indexing for search, sort, and filter operations
- **Migrations**: Version-controlled schema changes

**Caching Strategy**:
- HTTP Cache headers on all routes
- Cloudflare CDN edge caching (sMaxage)
- Stale-while-revalidate for background updates
- Example: `sMaxage: 24hours, staleWhileRevalidate: 1week`

### 3. Sync Layer

**Purpose**: Scrape and synchronize data from dharmaseed.org

**Components**:
- **Teacher Sync**: Fetches paginated teacher profiles
- **Talk Sync**: Fetches talks for each teacher with metadata enrichment
- **Retry Logic**: Exponential backoff for network resilience
- **Batch Processing**: Efficient bulk database operations

**Scheduling**:
- Cron job: Every 6 hours (configured in `wrangler.toml`)
- Manual trigger: `/api/sync` endpoint

### 4. Audio Player

**Purpose**: Global audio playback state management

**Implementation**:
- React Context API (`AudioContext`)
- Persistent across route navigation
- Keyboard shortcuts support
- Analytics integration (Plausible)

**Features**:
- Play/pause/seek controls
- Progress tracking
- Queue management (future)
- Playback history (future)

## Data Flow

### Page Load Flow

```
User Request
    ↓
Cloudflare Edge (cache check)
    ↓ (miss)
Remix Loader (server-side)
    ↓
Drizzle Query → D1 Database
    ↓
JSON Response
    ↓
React Component (client-side hydration)
    ↓
User sees page
```

### Sync Flow

```
Cron Trigger / Manual API Call
    ↓
Sync Agent Starts
    ↓
Fetch from dharmaseed.org
    ↓
Parse HTML → Extract Data
    ↓
Transform & Validate
    ↓
Batch Insert/Update → D1 Database
    ↓
Log Results
```

### Audio Playback Flow

```
User clicks play
    ↓
AudioContext.playTalk()
    ↓
HTMLAudioElement.play()
    ↓
Track analytics event
    ↓
Update UI (progress, controls)
    ↓
Persist across navigation
```

## Routing Architecture

Remix file-based routing with special patterns:

- `_index.tsx` - Home page (`/`)
- `talks.tsx` - List page (`/talks`)
- `talks_.$slug.tsx` - Detail page (`/talks/:slug`)
- `[robots.txt].tsx` - Dynamic file generation
- `api.sync.ts` - API endpoint (`/api/sync`)

### Loader Pattern

All routes use server-side loaders:

```typescript
export async function loader({ request, context }: LoaderFunctionArgs) {
  // 1. Parse URL params
  const { searchQuery, page, sort } = getRequestParams(request);

  // 2. Build database query
  const query = db.select().from(talks).where(/* filters */);

  // 3. Apply ordering
  query.orderBy(withOrdering({ field: sort.field, order: sort.order }));

  // 4. Paginate results
  return withPagination({ query, params: { page, perPage: 20 } });
}
```

## State Management

### Server State
- Database queries in loaders
- No client-side data fetching
- Remix handles revalidation

### Client State
- React Context for audio player
- URL search params for filters/pagination
- Local component state for UI

### Shared State
- Audio player context (global)
- Theme/preferences (future)
- User session (future)

## Performance Optimizations

### Database
- Compound indexes on common query patterns
- Window functions for pagination (single query)
- Left joins for optional relationships

### Caching
- Aggressive edge caching via Cloudflare CDN
- Stale-while-revalidate for perceived performance
- Route-level cache headers

### Frontend
- Automatic code splitting (Remix)
- Lazy loading of images
- Debounced search inputs
- Virtual scrolling (future for large lists)

### Sync
- Parallel processing where possible
- Batch database operations (50 per batch)
- Rate limiting (1s delay between pages)
- Skip processing flag for faster syncs

## Security

### API Endpoints
- Read-only public endpoints
- No authentication required (future: API keys)
- Rate limiting via Cloudflare (future)

### Data Scraping
- Respectful scraping (delays between requests)
- Retry with exponential backoff
- Error handling and logging

### Environment Variables
- Never committed to git (`.gitignore`)
- Cloudflare secrets for production
- Local `.dev.vars` for development

## Scalability Considerations

### Current Scale
- ~1000 teachers
- ~50,000 talks
- D1 free tier limits

### Future Scale
- R2 for audio file hosting
- KV for caching frequently accessed data
- Durable Objects for real-time features
- Analytics database for user tracking

## Deployment Architecture

### Development
- Local Wrangler server
- Local D1 database (SQLite file)
- Hot module reloading

### Production
- Cloudflare Pages (Git integration)
- Cloudflare Workers (serverless functions)
- Cloudflare D1 (distributed SQLite)
- Global CDN distribution

### CI/CD
- GitHub Actions (future)
- Automatic deploys on push to main
- Preview deployments for PRs

## Monitoring & Observability

### Logs
- Structured logging in sync agents
- Cloudflare Workers logs
- Error tracking (future: Sentry)

### Analytics
- Plausible for privacy-friendly analytics
- Custom events (play, search, etc.)
- Page depth tracking

### Metrics
- Database query performance
- Sync job duration
- CDN cache hit rates
- Error rates

## Future Architecture Enhancements

1. **User Accounts**: Auth0/Clerk integration
2. **Playlists**: User-generated playlists in D1
3. **RSS Feeds**: Per-user custom feeds
4. **Audio CDN**: R2 + custom domain
5. **Transcriptions**: Cloudflare AI Workers
6. **Real-time**: Durable Objects + PartyKit
7. **Search**: Full-text search via dedicated service
