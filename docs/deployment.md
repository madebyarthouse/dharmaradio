# Deployment Guide

This guide covers deploying Dharma Radio to Cloudflare Pages.

## Overview

Dharma Radio is deployed as a Cloudflare Pages application with:
- **Hosting**: Cloudflare Pages (Git integration)
- **Functions**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (distributed SQLite)
- **CDN**: Cloudflare global network

## Prerequisites

- Cloudflare account ([sign up](https://dash.cloudflare.com/sign-up))
- GitHub repository
- D1 database created
- Environment variables configured

## Initial Setup

### 1. Create D1 Database

```bash
# Create production database
npx wrangler d1 create dharmaradio

# Output will show database_id - save this
```

Update `wrangler.toml` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "dharmaradio"
database_id = "YOUR_DATABASE_ID"
```

### 2. Apply Migrations

```bash
# Apply to remote database
pnpm drizzle:migrate:remote
```

### 3. Connect GitHub Repository

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. Click "Create a project"
3. Connect your GitHub account
4. Select the dharmaradio repository
5. Configure build settings (see below)

### 4. Configure Build Settings

**Build command**:
```
pnpm build
```

**Build output directory**:
```
public
```

**Root directory**:
```
/
```

**Environment variables**:
- Node version: `18` or higher

### 5. Bind D1 Database

1. Go to your Pages project settings
2. Navigate to "Functions" → "D1 database bindings"
3. Add binding:
   - Variable name: `DB`
   - D1 database: Select your database

### 6. Deploy

Push to your main branch - Cloudflare will automatically build and deploy!

## Environment Variables

### Production

Set in Cloudflare Pages dashboard under "Settings" → "Environment variables":

```
NODE_VERSION=18
```

For Drizzle Studio/migrations (local only):
```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_DATABASE_ID=your_database_id
CLOUDFLARE_API_TOKEN=your_api_token
```

**Note**: These are NOT needed in production, only for local Drizzle Studio access.

### Getting API Credentials

1. **Account ID**: Found in Cloudflare dashboard URL: `dash.cloudflare.com/<account_id>/...`
2. **Database ID**: From `wrangler d1 create` command or dashboard
3. **API Token**: Create at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Use "Edit Cloudflare Workers" template
   - Grant D1 read/write permissions

## Deployment Workflow

### Automatic Deployments

Cloudflare Pages automatically deploys on:
- Push to `main` branch → Production
- Pull request → Preview deployment

### Manual Deployment

From Cloudflare dashboard:
1. Go to Pages project
2. Click "Deployments"
3. Click "Retry deployment" or "Create deployment"

### Rollback

To rollback to a previous deployment:
1. Go to "Deployments"
2. Find the working deployment
3. Click "Rollback to this deployment"

## Build Process

### What Happens During Build

1. **Install dependencies**: `pnpm install`
2. **Type check**: Remix runs TypeScript compiler
3. **Bundle**: Vite bundles client and server code
4. **Generate**: Creates `public/` directory with:
   - `_worker.js` - Cloudflare Worker
   - Static assets (JS, CSS, images)
   - `_routes.json` - Route manifest

### Build Output

```
public/
├── _worker.js           # Cloudflare Worker (server-side)
├── _routes.json         # Route configuration
├── assets/              # Hashed static assets
│   ├── entry.client-[hash].js
│   ├── root-[hash].js
│   └── *.css
├── favicon.ico
└── ...other static files
```

## Database Management

### Viewing Production Data

Use Drizzle Studio with remote database:

```bash
# Set env vars in .env
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_DATABASE_ID=...
CLOUDFLARE_API_TOKEN=...

# Open studio
pnpm drizzle:studio
```

### Seeding Production Database

```bash
# Execute SQL file
npx wrangler d1 execute dharmaradio --remote --file=./fixtures/dump.sql
```

### Backing Up Production Database

```bash
# Export to SQL
npx wrangler d1 export dharmaradio --remote --output=backup.sql
```

## Cron Jobs

Cron triggers are configured in `wrangler.toml`:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

This automatically calls the scheduled handler. In Remix, set up a cron endpoint:

**File**: `app/routes/api.cron.ts` (create this)

```typescript
export async function loader({ context }: LoaderFunctionArgs) {
  // Trigger sync
  await syncTeachers(context.cloudflare.env.DB);
  await syncTalks(context.cloudflare.env.DB);

  return json({ success: true });
}
```

Or use the existing `/api/sync` endpoint by having Cloudflare call it via cron.

### Monitoring Cron Jobs

1. Go to Cloudflare dashboard
2. Navigate to Workers & Pages → Your project
3. Click "Cron Triggers"
4. View execution history

## Custom Domains

### Adding a Custom Domain

1. Go to Pages project → "Custom domains"
2. Click "Set up a custom domain"
3. Enter domain (e.g., `dharmarad.io`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate (automatic)

### DNS Configuration

Cloudflare provides two options:
- **CNAME**: Points to your Pages deployment
- **A/AAAA**: Points to Cloudflare IPs

Both options work, CNAME is recommended.

## Analytics

### Cloudflare Web Analytics

Enable in Pages project settings → "Analytics"

### Plausible Analytics

Already integrated in code. Set up at [plausible.io](https://plausible.io):

1. Add site
2. Get script URL
3. Already configured in `app/root.tsx`

### PostHog Analytics

Already integrated. Configure in production:

1. Sign up at [posthog.com](https://posthog.com)
2. Get API key
3. Add to environment variables (if needed)

## Performance Optimization

### Caching

Routes already include cache headers:

```typescript
export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "6hours",
    sMaxage: "24hours",
    staleWhileRevalidate: "1week",
  }),
};
```

Cloudflare CDN automatically caches based on these headers.

### Compression

Cloudflare automatically compresses responses (gzip/brotli).

### Minification

Vite automatically minifies JS/CSS during build.

### Image Optimization

For better performance, consider:
- Cloudflare Images (paid)
- External image CDN (e.g., Cloudinary)
- `<img>` with `loading="lazy"`

## Monitoring

### Cloudflare Analytics

View in dashboard:
- Request volume
- Bandwidth usage
- Cache hit rate
- Error rates
- Performance metrics

### Real-time Logs

```bash
# Tail production logs
npx wrangler pages deployment tail
```

### Error Tracking

Consider adding:
- [Sentry](https://sentry.io) - Error tracking
- [LogFlare](https://logflare.app) - Log aggregation

Example Sentry setup:

```typescript
// app/entry.server.tsx
import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

## Security

### HTTPS

Automatic via Cloudflare (free SSL certificate).

### Environment Variables

Never commit sensitive data:
- `.env` → gitignored
- Set in Cloudflare dashboard
- Access via `context.cloudflare.env`

### API Rate Limiting

Consider adding rate limiting:

```typescript
// middleware or loader
const rateLimiter = new RateLimiter({
  limit: 100,
  window: 60, // 100 requests per minute
});

if (!rateLimiter.check(request.headers.get("CF-Connecting-IP"))) {
  throw new Response("Too many requests", { status: 429 });
}
```

### CORS

Configured in Remix:

```typescript
// app/entry.server.tsx
export const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
```

## Troubleshooting

### Build Fails

1. Check build logs in Cloudflare dashboard
2. Verify `pnpm build` works locally
3. Check Node version matches
4. Clear cache and retry

### Database Connection Issues

1. Verify D1 binding is configured
2. Check database ID in `wrangler.toml`
3. Ensure migrations are applied
4. Check logs for SQL errors

### 404 on Routes

1. Verify `_routes.json` is generated
2. Check route file naming
3. Clear Cloudflare cache
4. Redeploy

### Slow Response Times

1. Check cache headers are set
2. Verify CDN is caching (check response headers)
3. Optimize database queries
4. Consider adding indexes

### Memory/CPU Limits

Cloudflare Workers limits:
- CPU: 50ms per request (can be extended)
- Memory: 128MB

If hitting limits:
- Optimize sync jobs
- Use batch processing
- Consider Durable Objects for long-running tasks

## Costs

Cloudflare Pages is free for most use cases:
- **Pages**: Free (500 builds/month, unlimited requests)
- **Workers**: Free (100,000 requests/day)
- **D1**: Free tier (5GB storage, 5M reads/day, 100K writes/day)

Paid plans available for higher usage.

## CI/CD (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build

      # Cloudflare Pages will deploy automatically
```

## Next Steps

- [Architecture](./architecture.md) - System overview
- [Database Guide](./database.md) - Database management
- [Data Sync](./data-sync.md) - Cron job details
