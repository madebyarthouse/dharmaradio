# Dharma Radio

A browsable audio platform for dharma talks from [dharmaseed.org](https://dharmaseed.org). Built with React Router 7 on Cloudflare Workers, it scrapes and indexes teachers, talks, centers, and retreats into D1, with KV caching for performance.

Scheduled cron jobs keep content synchronized. The app uses edge caching for fast global delivery.

## Development

```bash
pnpm install
pnpm dev                    # Start local server
pnpm run d1:init:local     # Initialize local database
pnpm run db:migrate        # Run migrations
```

Open [http://127.0.0.1:8788](http://127.0.0.1:8788)

## Deployment

```bash
pnpm run deploy
```

See [CLAUDE.md](CLAUDE.md) for architecture details and operational notes.
