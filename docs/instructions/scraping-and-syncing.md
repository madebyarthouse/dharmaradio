# Scraping and syncing

## High level plan

- [ ] Scrape and sync data from dharmaseed.org to db via an API endpoint and a cron job
  - [ ] Add logging, debugging, metrics, retries, backoff, etc
- [ ] Add an export cli script to export the data to the other formats
- [ ] Run the export script via Github actions on a schedule
- [ ] Create a basic index route which explains the project and links to the data on Github/Cloudflare

## Scraping

- Scrape talks from dharmaseed.org
- Make the scraping script idempotent
- Make the scraping script robust against network or other issues
- The data will probably very rarely change, only new talks and maybe teacher coming in
- Add synced timestamp to the data so we know when it was last synced
- Use Drizzle ORM to save the talks to a database
- Use .sqlite locally and Cloudflare D1 in the cloud
- In production use a Cloudflare Cron job to hit the scrape endpoint
- Also setup a cli script to manually trigger the scrape to the DB
- Export the DB to the other formats (json, csv, sqlite) via Github actions
- Create an exports metadata db table to keep track of the exports and the latest ids written to file
- This is to that we don't refetch already exported data
- Run the exporting script via Github actions on a schedule
- Use `tsx` to run the exporting script
- Save the data in multiple formats: json, csv, sqlite
- Save it all together in a latest file
- Save it seperatley in type based files (talks, teachers, centers, etc)
