# Setting Up Scheduled Sync Jobs on Cloudflare

## 🚨 Important: Pages vs Workers

**Cloudflare Pages does NOT support cron triggers**. Cron jobs (scheduled tasks) are only available in Cloudflare Workers.

## Solution: Separate Worker for Cron Jobs

We use a separate Worker to trigger the sync API endpoint on a schedule.

### Architecture:

```
┌─────────────────────────┐
│  Cloudflare Pages       │
│  (Main App)             │
│  - Website              │
│  - API routes           │
│  - /api/sync endpoint   │
└─────────────────────────┘
           ↑
           │ HTTP GET request
           │ every 6 hours
           │
┌─────────────────────────┐
│  Cloudflare Worker      │
│  (Cron Scheduler)       │
│  - Runs on schedule     │
│  - Calls /api/sync      │
└─────────────────────────┘
```

## 📁 Files

- **`wrangler.toml`**: Pages configuration (NO triggers)
- **`wrangler-worker.toml`**: Worker configuration (WITH triggers)
- **`worker.js`**: Worker code that calls the sync endpoint

## 🚀 Deployment

### 1. Deploy Pages (Main App)

This happens automatically via GitHub integration:

```bash
git push origin main
```

### 2. Deploy Worker (Cron Scheduler)

Deploy the worker separately:

```bash
# Deploy the sync worker
wrangler deploy --config wrangler-worker.toml

# Or add to package.json scripts:
# "deploy:worker": "wrangler deploy --config wrangler-worker.toml"
```

### 3. Verify Worker is Running

```bash
# Check worker status
wrangler tail dharmaradio-sync-worker

# Trigger manually to test
wrangler publish --config wrangler-worker.toml
```

## 🔧 Alternative: Cloudflare Dashboard

You can also set up the cron trigger in the Cloudflare Dashboard:

1. Go to **Workers & Pages** → **Create Worker**
2. Name it `dharmaradio-sync-worker`
3. Paste the code from `worker.js`
4. Go to **Triggers** → **Cron Triggers**
5. Add schedule: `0 */6 * * *`

## 📝 Manual Trigger

You can still manually trigger sync via:

```bash
curl https://dharmarad.io/api/sync?command=all
```

## 🔐 Security Considerations

**Current setup**: The `/api/sync` endpoint is publicly accessible. Consider:

1. **Add authentication**: Require a secret token in headers
2. **Rate limiting**: Prevent abuse
3. **IP allowlisting**: Only allow Cloudflare Worker IPs

Example with auth:

```javascript
// In worker.js
const response = await fetch("https://dharmarad.io/api/sync?command=all", {
  headers: {
    "User-Agent": "Cloudflare-Worker-Cron",
    "X-Sync-Token": env.SYNC_SECRET, // Add secret to worker env vars
  },
});
```

Then check the token in your `app/routes/api.sync.ts`.

## 📊 Monitoring

View worker logs:

```bash
wrangler tail dharmaradio-sync-worker
```

Check cron execution history in Cloudflare Dashboard:

- Workers & Pages → dharmaradio-sync-worker → Metrics

## 🆘 Troubleshooting

**Cron not running?**

- Check worker is deployed: `wrangler deployments list --name dharmaradio-sync-worker`
- Verify cron schedule in Dashboard
- Check worker logs: `wrangler tail dharmaradio-sync-worker`

**Sync failing?**

- Test endpoint directly: `curl https://dharmarad.io/api/sync`
- Check Pages deployment logs
- Verify D1 database bindings are correct


