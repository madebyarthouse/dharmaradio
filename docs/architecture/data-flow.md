# Data Flow Architecture

## Scraping Pipeline

1. **Data Collection**

   - Scheduled scraping of dharmaseed.org
   - Incremental updates for new content
   - Robust error handling and retry mechanisms

2. **Data Processing**

   - Normalization of scraped data
   - Relationship mapping between entities
   - Validation and sanitization
   - Metadata enhancement

3. **Storage**
   - Primary storage in D1 database
   - Caching layer in KV store
   - Regular exports to static formats

## User Flow

1. **Content Discovery**

   - Browse interface for talks/teachers/centers
   - Search functionality
   - Filtering and sorting options
   - Related content suggestions

2. **Content Consumption**

   - Web-based audio player
   - Progress tracking
   - Playlist management
   - Download options

3. **User Features**
   - History tracking
   - Favorites and bookmarks
   - Custom RSS feed generation
   - Account management
