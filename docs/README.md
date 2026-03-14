# Dharma Radio Documentation

Welcome to the Dharma Radio documentation. This guide will help you understand, develop, and contribute to the project.

## 📚 Table of Contents

- [Getting Started](./getting-started.md) - Setup and installation
- [Architecture](./architecture.md) - System design and technical overview
- [Database](./database.md) - Schema, migrations, and queries
- [Data Sync](./data-sync.md) - How data is scraped and synchronized
- [Audio Player](./audio-player.md) - Audio playback implementation
- [Routing & Loaders](./routing-loaders.md) - Remix routing patterns
- [UI Components](./ui-components.md) - Component library and usage
- [Deployment](./deployment.md) - Deploy to Cloudflare Pages
- [API Reference](./api-reference.md) - API endpoints and usage

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Initialize local database
pnpm d1:init:local

# Start development server
pnpm dev
```

Visit http://127.0.0.1:8788

## 🎯 Project Goals

Dharma Radio aims to make dharma talks from dharmaseed.org more accessible through:

1. **Modern Web Player** - Podcast-style interface with persistent audio player
2. **Better Discovery** - Search, filter, and browse teachers, centers, and retreats
3. **Open Data** - Provide JSON, CSV, SQLite exports and public API
4. **Future Features**:
   - User accounts with history, saves, and playlists
   - Custom RSS podcast feeds
   - R2-hosted audio for better performance
   - AI transcriptions and analysis

## 🛠 Tech Stack

- **Frontend**: React + Remix + TailwindCSS
- **Backend**: Cloudflare Pages/Workers
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle
- **Analytics**: Plausible (privacy-friendly)
- **Package Manager**: pnpm

## 📖 Additional Resources

- [Remix Documentation](https://remix.run/docs)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

## 🤝 Contributing

See individual documentation pages for detailed contribution guidelines. Key principles:

- Follow TypeScript strict mode (no `any`)
- Use functional React components
- Include loading/error states
- Write accessible markup
- Add tests for new features
- Update documentation

## 📝 License

This is an open-source project for educational purposes. Dharma talks remain property of their respective teachers and dharmaseed.org.
