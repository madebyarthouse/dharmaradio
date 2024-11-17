import { parseTalksFromHtml } from "./parse-html";
import { urlForPage } from "./utils";
import type { ScrapedTalk } from "./types";
import type { D1Database } from "@cloudflare/workers-types";
import { db } from "../../db/client.server";
import { talks } from "../../db/schema";
import { inArray } from "drizzle-orm";
import { Logger } from "./logger";
import { withRetry } from "./retry";

const logger = new Logger("fetch-talks");

async function filterNewTalks(
  database: D1Database,
  scrapedTalks: ScrapedTalk[]
): Promise<ScrapedTalk[]> {
  if (scrapedTalks.length === 0) return [];

  const drizzleDb = db(database);
  const talkIds = scrapedTalks.map((t) => t.talkId);

  // Get existing talk IDs in a single query
  const existingTalks = await drizzleDb
    .select({ dharmaSeedId: talks.dharmaSeedId })
    .from(talks)
    .where(inArray(talks.dharmaSeedId, talkIds));

  const existingIds = new Set(existingTalks.map((t) => t.dharmaSeedId));

  // Filter out existing talks
  return scrapedTalks.filter((talk) => !existingIds.has(talk.talkId));
}

type ProcessPageCallback = (talks: ScrapedTalk[]) => Promise<void>;

export async function fetchTalksFromDharmaseed(
  database: D1Database,
  processPage: ProcessPageCallback,
  maxPages?: number,
  skipProcessing = false
): Promise<void> {
  let page = 1;
  let shouldContinue = true;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalExisting = 0;

  logger.info("Starting fetch", { skipProcessing });

  while (shouldContinue) {
    try {
      // Fetch and parse talks from the current page
      const scrapedTalks = await withRetry(
        async () => {
          const response = await fetch(urlForPage(page));
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const html = await response.text();
          return parseTalksFromHtml(html);
        },
        {
          maxAttempts: 3,
          initialDelay: 3000,
          maxDelay: 10000,
        }
      );

      logger.info(`Fetched page ${page}`, {
        scrapedTalks: scrapedTalks.length,
        totalProcessed,
        totalSkipped,
        totalExisting,
      });

      // No more talks to process
      if (scrapedTalks.length === 0) {
        shouldContinue = false;
        break;
      }

      // Always filter to check what exists
      const newTalks = await filterNewTalks(database, scrapedTalks);
      const existingCount = scrapedTalks.length - newTalks.length;
      totalExisting += existingCount;

      if (skipProcessing && newTalks.length === 0) {
        totalSkipped += newTalks.length;
        logger.info("Skipping processing", {
          page,
          newTalks: newTalks.length,
          existing: existingCount,
          totalSkipped,
          totalExisting,
        });
      } else {
        // Process only if not skipping
        if (newTalks.length > 0) {
          await processPage(newTalks);
          totalProcessed += newTalks.length;
        }
      }

      // If no new talks are found, we can stop
      if (newTalks.length === 0 && !skipProcessing) {
        logger.info("No new talks found, stopping fetch", {
          page,
          totalProcessed,
          totalSkipped,
          totalExisting,
        });
        shouldContinue = false;
        break;
      }

      // Check if we've reached the max pages limit
      if (maxPages && page >= maxPages) {
        shouldContinue = false;
      } else {
        page++;
        // Add a small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Failed to process page ${page}`, error as Error, {
        totalProcessed,
        totalSkipped,
        totalExisting,
      });
      throw error;
    }
  }

  logger.info("Fetch completed", {
    totalPages: page,
    totalProcessed,
    totalSkipped,
    totalExisting,
    skipProcessing,
  });
}
