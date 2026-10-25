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

## Accounts setup

Copy `.dev.vars.example` to `.dev.vars` for local development. OTP codes appear in
Worker logs locally; real email is never sent in dev. In production, configure
`BETTER_AUTH_SECRET` (random, at least 32 characters) and `BETTER_AUTH_URL` (the
canonical HTTPS origin).
Sign-in is email-only for now (no Google or Apple).

Onboard your sender domain in Cloudflare Email Service **Email Sending**, replace
the TODO sender in `wrangler.jsonc`'s `EMAIL` (`send_email`) binding, and set
`EMAIL_FROM` to that address. Email Sending access is required for mail to arbitrary
users; Email Routing's verified-destination sending alone is insufficient. Accounts
use six-digit email OTPs (10-minute expiry), which work inside installed PWAs.
Apply the generated D1 migrations through your deployment process before enabling
accounts. Production migration/deployment is an operator step.

Both `db:import:*` scripts now upsert **catalogue tables only** (teachers, centers,
retreats, talks, sync_runs). They preserve destination accounts, library data and
`d1_migrations`; apply schema migrations separately. They do not delete stale
catalogue rows. Upserts intentionally avoid SQLite REPLACE, which would cascade
into user library references.

API references: [Better Auth OTP](https://better-auth.com/docs/plugins/email-otp),
[Cloudflare Email Sending](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/).
