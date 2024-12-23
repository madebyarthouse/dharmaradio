# Dharma Radio Documentation

## Overview

Dharma Radio is a web application that provides a modern, accessible interface for Buddhist dharma talks from dharmaseed.org. It serves as both a web player and a data aggregation service, making dharma talks more accessible to practitioners.

## Core Features

- Web-based audio player for dharma talks
- Browse and search functionality for:
  - Teachers
  - Centers
  - Talks
  - Retreats
- User accounts with personalized features:
  - Listening history
  - Saved talks
  - Custom playlists
- Custom RSS podcast feed generation
- Multi-format data exports (JSON, CSV, SQLite)
- API access to the dharma talk database

## Architecture

### Frontend

- React-based single-page application
- Remix for server-side rendering and data loading
- TailwindCSS for styling
- Radix UI for accessible component primitives
- Mobile-first responsive design

### Backend

- Cloudflare Pages for hosting
- Cloudflare Workers for serverless functions
- Cloudflare D1 (SQLite) for database
- Cloudflare R2 for static asset storage
- Cloudflare KV for caching
- Drizzle ORM for database operations

### Data Pipeline

1. Scraping service fetches data from dharmaseed.org
2. Data is processed and normalized
3. Storage in D1 database
4. Regular exports to multiple formats
5. API endpoints expose the data
6. Caching layer for performance optimization

## Data Model

The application manages four primary data types:

1. **Talks** - Individual dharma talks with audio
2. **Teachers** - Dharma teachers and their information
3. **Centers** - Meditation centers and organizations
4. **Retreats** - Organized meditation retreats

Each entity maintains relationships with others, allowing for rich navigation and discovery of content.

## Deployment

The application is deployed on Cloudflare's edge network, providing:

- Global CDN distribution
- Low-latency access
- High availability
- Automatic scaling

## Development

The project uses modern development practices:

- TypeScript for type safety
- GitHub Actions for CI/CD
- Automated testing
- Accessibility-first development
- Performance monitoring

## Future Plans

- Audio file mirroring to R2 storage
- Talk transcription services
- Content analysis and insights
- Enhanced search capabilities
- Additional export formats
- Extended API functionality

For detailed implementation guides and API documentation, see the respective sections in the docs folder.
