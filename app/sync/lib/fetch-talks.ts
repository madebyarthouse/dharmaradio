import { parseTalksFromHtml } from "./parse-html";
import { urlForPage } from "./utils";
import type { ScrapedTalk } from "./types";
import type { D1Database } from "@cloudflare/workers-types";
import { db } from "../../db/client.server";
import { talks } from "../../db/schema";
import { inArray } from "drizzle-orm";
import { Logger } from "./logger";
import { withRetry } from "./retry";
import type { SyncMode } from "../types";

const logger = new Logger("fetch-talks");

async function filterNewTalks(
  database: D1Database,
  scrapedTalks: ScrapedTalk[],
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

export type FetchTalksStats = {
  lastPageFetched: number;
  lastPageNewTalkCount: number;
  lastPageTalkCount: number;
  pagesFetched: number;
  reachedPageLimit: boolean;
  stopReason: "known_page_reached" | "no_scraped_talks" | "page_limit_reached";
  totalExisting: number;
  totalProcessed: number;
  totalSkipped: number;
};

export type FetchTalksOptions = {
  maxPages?: number;
  mode?: SyncMode;
  skipProcessing?: boolean;
};

export async function fetchTalksFromDharmaseed(
  database: D1Database,
  processPage: ProcessPageCallback,
  options: FetchTalksOptions = {},
): Promise<FetchTalksStats> {
  const {
    maxPages,
    mode = "incremental",
    skipProcessing = false,
  } = options;
  let page = 1;
  let pagesFetched = 0;
  let shouldContinue = true;
  let stopReason: FetchTalksStats["stopReason"] = "no_scraped_talks";
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalExisting = 0;
  let lastPageFetched = 0;
  let lastPageTalkCount = 0;
  let lastPageNewTalkCount = 0;

  logger.info("Starting fetch", { maxPages, mode, skipProcessing });

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
        },
      );

      pagesFetched++;
      lastPageFetched = page;
      lastPageTalkCount = scrapedTalks.length;

      logger.info(`Fetched page ${page}`, {
        scrapedTalks: scrapedTalks.length,
        totalProcessed,
        totalSkipped,
        totalExisting,
      });

      // No more talks to process
      if (scrapedTalks.length === 0) {
        stopReason = "no_scraped_talks";
        shouldContinue = false;
        break;
      }

      // Always filter to check what exists
      const newTalks = await filterNewTalks(database, scrapedTalks);
      const existingCount = scrapedTalks.length - newTalks.length;
      lastPageNewTalkCount = newTalks.length;
      totalExisting += existingCount;
      const talksToProcess = mode === "full" ? scrapedTalks : newTalks;

      if (skipProcessing && talksToProcess.length === 0) {
        totalSkipped += talksToProcess.length;
        logger.info("Skipping processing", {
          page,
          newTalks: newTalks.length,
          talksToProcess: talksToProcess.length,
          existing: existingCount,
          totalSkipped,
          totalExisting,
        });
      } else {
        // Process only if not skipping
        if (talksToProcess.length > 0) {
          await processPage(talksToProcess);
          totalProcessed += talksToProcess.length;
        }
      }

      // Incremental mode stops once we reach a fully-known page.
      if (mode === "incremental" && newTalks.length === 0 && !skipProcessing) {
        stopReason = "known_page_reached";
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
        stopReason = "page_limit_reached";
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
    lastPageFetched,
    pagesFetched,
    stopReason,
    totalProcessed,
    totalSkipped,
    totalExisting,
    mode,
    skipProcessing,
  });

  return {
    lastPageFetched,
    lastPageNewTalkCount,
    lastPageTalkCount,
    pagesFetched,
    reachedPageLimit: stopReason === "page_limit_reached",
    stopReason,
    totalExisting,
    totalProcessed,
    totalSkipped,
  };
}
