import { type D1Database } from "@cloudflare/workers-types";
import { db } from "../db/client.server";
import { talks, teachers, retreats, centers } from "../db/schema";
import { fetchTalksFromDharmaseed } from "./lib/fetch-talks";
import { fetchTeacherFromDharmaseed } from "./lib/fetch-teacher";
import { slugify, sumTime, dharmaSeedBase } from "./lib/utils";
import { sql, eq } from "drizzle-orm";
import { Logger } from "./lib/logger";
import { processBatch } from "./lib/batch";
import { withRetry } from "./lib/retry";
import type { ScrapedTalk } from "./lib/types";

const logger = new Logger("sync-to-db");

interface ProcessTalkContext {
  database: D1Database;
  drizzleDb: ReturnType<typeof db>;
}

type SyncStats = {
  talks: {
    processed: number;
    failed: { id: number; title: string; error: string }[];
  };
  teachers: {
    processed: number;
    failed: { id: number; name: string; error: string }[];
  };
  retreats: {
    processed: number;
    failed: { id: number; title: string; error: string }[];
  };
  centers: {
    processed: number;
    failed: { id: number; title: string; error: string }[];
  };
};

const stats: SyncStats = {
  talks: { processed: 0, failed: [] },
  teachers: { processed: 0, failed: [] },
  retreats: { processed: 0, failed: [] },
  centers: { processed: 0, failed: [] },
};

async function upsertTeacher(
  scrapedTalk: ScrapedTalk,
  ctx: ProcessTalkContext
) {
  const { drizzleDb } = ctx;

  try {
    // Extract teacher ID from URL if available
    const teacherId = scrapedTalk.teacherUrl
      ? parseInt(scrapedTalk.teacherUrl.split("/").pop() ?? "0")
      : null;

    if (!teacherId) {
      logger.warn("No teacher ID found for talk", {
        talkId: scrapedTalk.talkId,
        teacherName: scrapedTalk.teacher,
        teacherUrl: scrapedTalk.teacherUrl,
      });
      return null;
    }

    // First try to find existing teacher by dharmaseed ID
    try {
      const existingTeacher = await drizzleDb
        .select({
          id: teachers.id,
          dharmaSeedId: teachers.dharmaSeedId,
        })
        .from(teachers)
        .where(eq(teachers.dharmaSeedId, teacherId))
        .get();

      logger.debug("Teacher lookup result", {
        teacherId,
        existingTeacher,
        talkId: scrapedTalk.talkId,
      });

      if (existingTeacher) {
        return existingTeacher;
      }
    } catch (error) {
      logger.error("Failed to lookup existing teacher", error as Error, {
        teacherId,
        talkId: scrapedTalk.talkId,
      });
      throw error;
    }

    // Fetch teacher details
    let teacherData;
    try {
      teacherData = await withRetry(() =>
        fetchTeacherFromDharmaseed(teacherId)
      );
    } catch (error) {
      logger.error("Failed to fetch teacher data", error as Error, {
        teacherId,
        talkId: scrapedTalk.talkId,
      });
      throw error;
    }

    // Insert new teacher
    try {
      const teacher = await drizzleDb
        .insert(teachers)
        .values({
          name: teacherData.name,
          slug: slugify(teacherData.name, teacherData.dharmaSeedId),
          description: teacherData.description,
          profileImageUrl: teacherData.profileImageUrl,
          websiteUrl: teacherData.websiteUrl,
          donationUrl: teacherData.donationUrl,
          dharmaSeedId: teacherData.dharmaSeedId,
          publishedOn: sql`CURRENT_TIMESTAMP`,
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: teachers.dharmaSeedId,
          set: {
            name: teacherData.name,
            description: teacherData.description,
            profileImageUrl: teacherData.profileImageUrl,
            websiteUrl: teacherData.websiteUrl,
            donationUrl: teacherData.donationUrl,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning()
        .get();

      if (!teacher) {
        throw new Error(`Failed to upsert teacher: ${scrapedTalk.teacher}`);
      }

      stats.teachers.processed++;
      return teacher;
    } catch (error) {
      logger.error("Failed to upsert teacher", error as Error, {
        teacherId,
        teacherData,
        talkId: scrapedTalk.talkId,
      });
      throw error;
    }
  } catch (error) {
    const teacherId = parseInt(scrapedTalk.teacherUrl?.split("/").pop() ?? "0");
    stats.teachers.failed.push({
      id: teacherId,
      name: scrapedTalk.teacher,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    logger.error("Teacher processing failed", error as Error, {
      talk: {
        id: scrapedTalk.talkId,
        title: scrapedTalk.title,
        teacher: scrapedTalk.teacher,
        teacherUrl: scrapedTalk.teacherUrl,
      },
    });
    throw error;
  }
}

async function processRetreat(
  scrapedTalk: ScrapedTalk,
  ctx: ProcessTalkContext
) {
  const { drizzleDb } = ctx;

  try {
    // If there's no retreat info, return null - this is a valid case
    if (!scrapedTalk.retreat || !scrapedTalk.retreatId) {
      stats.retreats.processed++; // Count it as processed - it's just a talk without a retreat
      return null;
    }

    const retreat = await drizzleDb
      .insert(retreats)
      .values({
        title: scrapedTalk.retreat,
        slug: slugify(scrapedTalk.retreat, scrapedTalk.retreatId),
        dharmaSeedId: scrapedTalk.retreatId,
        description: null,
        language: "en",
        lastBuildDate: sql`CURRENT_TIMESTAMP`,
        createdAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: retreats.dharmaSeedId,
        set: {
          updatedAt: sql`CURRENT_TIMESTAMP`,
          title: scrapedTalk.retreat,
        },
      })
      .returning()
      .get();

    logger.debug("Retreat upsert result", {
      retreatId: scrapedTalk.retreatId,
      retreat,
      talkId: scrapedTalk.talkId,
    });

    stats.retreats.processed++;
    return retreat;
  } catch (error) {
    // Only track as failure if there was an actual error processing a retreat
    if (scrapedTalk.retreatId) {
      stats.retreats.failed.push({
        id: scrapedTalk.retreatId,
        title: scrapedTalk.retreat ?? "Unknown retreat",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      logger.error("Failed to process retreat", error as Error, {
        retreatId: scrapedTalk.retreatId,
        retreat: scrapedTalk.retreat,
        talkId: scrapedTalk.talkId,
      });
    }
    throw error;
  }
}

async function processCenter(
  scrapedTalk: ScrapedTalk,
  ctx: ProcessTalkContext
) {
  const { drizzleDb } = ctx;

  try {
    // If there's no center info, return null - this is a valid case
    if (!scrapedTalk.center || !scrapedTalk.centerSubdomain) {
      console.log({
        scrapedTalk,
      });
      stats.centers.processed++; // Count it as processed
      return null;
    }

    const center = await drizzleDb
      .insert(centers)
      .values({
        name: scrapedTalk.center,
        slug: slugify(scrapedTalk.center, scrapedTalk.centerSubdomain),
        description: null,
        dharmaSeedSubdomain: scrapedTalk.centerSubdomain,
        createdAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: centers.dharmaSeedSubdomain,
        set: {
          updatedAt: sql`CURRENT_TIMESTAMP`,
          name: scrapedTalk.center,
        },
      })
      .returning()
      .get();

    logger.debug("Center upsert result", {
      centerSubdomain: scrapedTalk.centerSubdomain,
      center,
      talkId: scrapedTalk.talkId,
    });

    stats.centers.processed++;
    return center;
  } catch (error) {
    if (scrapedTalk.centerSubdomain) {
      stats.centers.failed.push({
        id: 0, // Centers don't have IDs in dharmaseed
        title: scrapedTalk.center ?? "Unknown center",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      logger.error("Failed to process center", error as Error, {
        centerSubdomain: scrapedTalk.centerSubdomain,
        center: scrapedTalk.center,
        talkId: scrapedTalk.talkId,
      });
    }
    throw error;
  }
}

async function processTalk(scrapedTalk: ScrapedTalk, ctx: ProcessTalkContext) {
  try {
    logger.debug("Processing talk", {
      talkId: scrapedTalk.talkId,
      title: scrapedTalk.title,
    });

    const teacher = await upsertTeacher(scrapedTalk, ctx);
    if (!teacher) {
      throw new Error(`Failed to get teacher for talk: ${scrapedTalk.title}`);
    }

    const center = await processCenter(scrapedTalk, ctx);
    const retreat = await processRetreat(scrapedTalk, ctx);

    const audioUrl = scrapedTalk.audioUrl?.startsWith("http")
      ? scrapedTalk.audioUrl
      : `${dharmaSeedBase}${scrapedTalk.audioUrl}`;

    try {
      await ctx.drizzleDb
        .insert(talks)
        .values({
          title: scrapedTalk.title,
          slug: slugify(scrapedTalk.title, scrapedTalk.talkId),
          description: scrapedTalk.description,
          audioUrl,
          externalGuid: `dharmaseed-talk-${scrapedTalk.talkId}`,
          teacherId: teacher.id,
          centerId: center?.id ?? null,
          retreatId: retreat?.id ?? null,
          dharmaSeedId: scrapedTalk.talkId,
          duration: sumTime(scrapedTalk.time),
          publicationDate: sql`CURRENT_TIMESTAMP`,
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: talks.dharmaSeedId,
          set: {
            updatedAt: sql`CURRENT_TIMESTAMP`,
            title: scrapedTalk.title,
            description: scrapedTalk.description,
            audioUrl,
            centerId: center?.id ?? null,
          },
        });

      logger.info(`Processed talk successfully`, {
        talkId: scrapedTalk.talkId,
        title: scrapedTalk.title,
        teacherId: teacher.id,
        centerId: center?.id,
        retreatId: retreat?.id,
      });
    } catch (error) {
      logger.error("Failed to upsert talk", error as Error, {
        talk: {
          id: scrapedTalk.talkId,
          title: scrapedTalk.title,
        },
        teacher,
        center,
        retreat,
      });
      throw error;
    }

    stats.talks.processed++;
  } catch (error) {
    stats.talks.failed.push({
      id: scrapedTalk.talkId,
      title: scrapedTalk.title,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    logger.error("Failed to process talk", error as Error, {
      talkId: scrapedTalk.talkId,
      title: scrapedTalk.title,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export const syncTalks = async (
  database: D1Database,
  skipProcessing = false
) => {
  const drizzleDb = db(database);
  const ctx: ProcessTalkContext = { database, drizzleDb };
  const startTime = Date.now();

  try {
    logger.info("Starting sync", { skipProcessing });

    await fetchTalksFromDharmaseed(
      database,
      async (talks) => {
        await processBatch(talks, (talk) => processTalk(talk, ctx), {
          batchSize: 10,
        });
      },
      undefined, // maxPages
      skipProcessing
    );

    logger.info("Sync completed successfully");
  } catch (error) {
    logger.error("Sync failed", error as Error);
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(0);

    logger.info("Sync statistics", {
      duration: `${minutes}m ${seconds}s`,
      talks: {
        processed: stats.talks.processed,
        failed: stats.talks.failed.length,
        failureDetails:
          stats.talks.failed.length > 0 ? stats.talks.failed : undefined,
      },
      teachers: {
        processed: stats.teachers.processed,
        failed: stats.teachers.failed.length,
        failureDetails:
          stats.teachers.failed.length > 0 ? stats.teachers.failed : undefined,
      },
      retreats: {
        processed: stats.retreats.processed,
        failed: stats.retreats.failed.length,
        failureDetails:
          stats.retreats.failed.length > 0 ? stats.retreats.failed : undefined,
      },
      centers: {
        processed: stats.centers.processed,
        failed: stats.centers.failed.length,
        failureDetails:
          stats.centers.failed.length > 0 ? stats.centers.failed : undefined,
      },
      successRate: {
        talks: `${(
          (stats.talks.processed /
            (stats.talks.processed + stats.talks.failed.length)) *
          100
        ).toFixed(1)}%`,
        teachers: `${(
          (stats.teachers.processed /
            (stats.teachers.processed + stats.teachers.failed.length)) *
          100
        ).toFixed(1)}%`,
        retreats: `${(
          (stats.retreats.processed /
            (stats.retreats.processed + stats.retreats.failed.length)) *
          100
        ).toFixed(1)}%`,
        centers: `${(
          (stats.centers.processed /
            (stats.centers.processed + stats.centers.failed.length)) *
          100
        ).toFixed(1)}%`,
      },
    });
  }
};
