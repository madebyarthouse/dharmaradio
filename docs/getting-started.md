# Getting Started

This guide will help you set up Dharma Radio for local development.

## Prerequisites

- **Node.js**: >=18.0.0 (see `.node-version`)
- **pnpm**: Package manager (install: `npm install -g pnpm`)
- **Cloudflare Account**: For remote database access (optional for local dev)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd dharmaradio
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
```

For local development, you can leave these empty. For remote database access (Drizzle Studio, migrations), set:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_DATABASE_ID=your_database_id
CLOUDFLARE_API_TOKEN=your_api_token
```

### 4. Initialize Local Database

Load fixture data into your local D1 database:

```bash
pnpm d1:init:local
```

This imports the SQL dump from `fixtures/dump.sql`.

### 5. Start Development Server

```bash
pnpm dev
```

The app will be available at http://127.0.0.1:8788

## Development Workflow

### Running the Dev Server

```bash
pnpm dev  # Starts Remix + Wrangler in dev mode
```

This uses Wrangler to emulate the Cloudflare Workers runtime locally, including D1 database access.

### Type Checking

```bash
pnpm typecheck  # Run TypeScript compiler
```

### Linting

```bash
pnpm lint  # Run ESLint
```

### Formatting

```bash
pnpm format  # Format with Prettier
```

## Database Management

### View Database

Open Drizzle Studio to browse your database:

```bash
pnpm drizzle:studio
```

This opens a web UI at https://local.drizzle.studio

### Creating Migrations

After modifying `app/db/schema.ts`:

```bash
pnpm drizzle:update  # Generate migration files
```

### Applying Migrations

**Local**:
```bash
pnpm drizzle:migrate:local
```

**Remote** (production):
```bash
pnpm drizzle:migrate:remote
```

## Syncing Data

### Trigger Data Sync

The sync endpoint scrapes data from dharmaseed.org:

```bash
# Sync everything
curl http://127.0.0.1:8788/api/sync

# Sync only teachers
curl http://127.0.0.1:8788/api/sync?command=teachers

# Sync only talks (faster with skipProcessing)
curl http://127.0.0.1:8788/api/sync?command=talks&skipProcessing=true
```

**Note**: Full sync takes a long time (many API calls to dharmaseed.org). Use `skipProcessing=true` for faster results during development.

## Project Structure

```
dharmaradio/
├── app/
│   ├── components/       # React components
│   ├── contexts/         # React contexts (audio player)
│   ├── db/              # Database schema & client
│   │   ├── schema.ts    # Drizzle schema definition
│   │   ├── migrations/  # Auto-generated migrations
│   │   └── client.server.ts
│   ├── routes/          # Remix routes (pages & API)
│   ├── sync/            # Data sync agents
│   │   ├── lib/         # Sync utilities
│   │   ├── sync-teachers.ts
│   │   └── sync-to-db.ts
│   ├── utils/           # Utility functions
│   ├── root.tsx         # App root component
│   └── entry.*.tsx      # Remix entry points
├── docs/                # This documentation
├── fixtures/            # Fixture data (SQL dumps)
├── public/              # Static assets
├── build/               # Build output (gitignored)
├── wrangler.toml        # Cloudflare Workers config
├── drizzle.config.ts    # Drizzle ORM config
├── vite.config.ts       # Vite bundler config
└── package.json
```

## Common Issues

### Port Already in Use

If port 8788 is already in use:

1. Find the process: `lsof -ti:8788`
2. Kill it: `kill -9 <PID>`
3. Or change the port in `wrangler.toml`

### Database Not Found

If you see database errors:

```bash
# Reinitialize local database
pnpm d1:init:local
```

### Build Errors After Pulling Changes

```bash
# Clean install
rm -rf node_modules .cache build
pnpm install
```

### TypeScript Errors

```bash
# Regenerate types
pnpm typecheck
```

## Next Steps

- [Architecture Overview](./architecture.md) - Understand the system design
- [Database Guide](./database.md) - Learn about the schema
- [Data Sync Guide](./data-sync.md) - How data flows work
- [UI Components](./ui-components.md) - Build new components

## Getting Help

- Check existing [GitHub Issues](../../issues)
- Review [.cursorrules](../.cursorrules) for coding guidelines
- Read [CLAUDE.md](../CLAUDE.md) for AI agent guidance
