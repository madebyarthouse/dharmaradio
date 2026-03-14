import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.server";
import { centers, retreats, talks, teachers } from "../db/schema";
import type { SyncExecutionResult, SyncTalksOptions } from "./types";
import { fetchTalksFromDharmaseed } from "./lib/fetch-talks";
import { fetchTeacherFromDharmaseed } from "./lib/fetch-teacher";
import { Logger } from "./lib/logger";
import { withRetry } from "./lib/retry";
import type { ScrapedTalk } from "./lib/types";
import { dharmaSeedBase, slugify, sumTime } from "./lib/utils";

const logger = new Logger("sync-to-db");

function normalizeAudioUrl(audioUrl: string | null) {
  if (!audioUrl) return null;
  return audioUrl.startsWith("http") ? audioUrl : `${dharmaSeedBase}${audioUrl}`;
}

type Failure = {
  error: string;
  id: number;
  title: string;
};

type SyncStats = {
  centers: {
    failed: Failure[];
    processed: number;
  };
  retreats: {
    failed: Failure[];
    processed: number;
  };
  talks: {
    failed: Failure[];
    processed: number;
  };
  teachers: {
    failed: Failure[];
    processed: number;
  };
};

type ProcessTalkContext = {
  drizzleDb: ReturnType<typeof db>;
  stats: SyncStats;
};

const createEmptyStats = (): SyncStats => ({
  centers: { failed: [], processed: 0 },
  retreats: { failed: [], processed: 0 },
  talks: { failed: [], processed: 0 },
  teachers: { failed: [], processed: 0 },
});

async function upsertTeacher(scrapedTalk: ScrapedTalk, ctx: ProcessTalkContext) {
  const { drizzleDb, stats } = ctx;

  const teacherId = scrapedTalk.teacherUrl
    ? Number.parseInt(scrapedTalk.teacherUrl.split("/").pop() ?? "0", 10)
    : null;

  if (!teacherId) {
    logger.warn("No teacher ID found for talk", {
      talkId: scrapedTalk.talkId,
      teacherName: scrapedTalk.teacher,
      teacherUrl: scrapedTalk.teacherUrl,
    });
    return null;
  }

  const existingTeacher = await drizzleDb
    .select({
      id: teachers.id,
      dharmaSeedId: teachers.dharmaSeedId,
    })
    .from(teachers)
    .where(eq(teachers.dharmaSeedId, teacherId))
    .get();

  if (existingTeacher) {
    return existingTeacher;
  }

  const teacherData = await withRetry(() =>
    fetchTeacherFromDharmaseed(teacherId),
  );

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
    throw new Error(`Failed to upsert teacher ${scrapedTalk.teacher}`);
  }

  stats.teachers.processed++;
  return teacher;
}

async function processRetreat(
  scrapedTalk: ScrapedTalk,
  ctx: ProcessTalkContext,
) {
  const { drizzleDb, stats } = ctx;

  if (!scrapedTalk.retreat || !scrapedTalk.retreatId) {
    stats.retreats.processed++;
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
        title: scrapedTalk.retreat,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning()
    .get();

  stats.retreats.processed++;
  return retreat;
}

async function processCenter(scrapedTalk: ScrapedTalk, ctx: ProcessTalkContext) {
  const { drizzleDb, stats } = ctx;

  if (!scrapedTalk.center || !scrapedTalk.centerSubdomain) {
    stats.centers.processed++;
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
        name: scrapedTalk.center,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning()
    .get();

  stats.centers.processed++;
  return center;
}

export async function processTalk(
  scrapedTalk: ScrapedTalk,
  ctx: ProcessTalkContext,
) {
  try {
    const teacher = await upsertTeacher(scrapedTalk, ctx).catch((error) => {
      const teacherId = Number.parseInt(
        scrapedTalk.teacherUrl?.split("/").pop() ?? "0",
        10,
      );
      ctx.stats.teachers.failed.push({
        error: error instanceof Error ? error.message : "Unknown error",
        id: teacherId,
        title: scrapedTalk.teacher,
      });
      logger.error("Failed to process teacher", error as Error, {
        talkId: scrapedTalk.talkId,
        teacher: scrapedTalk.teacher,
      });
      return null;
    });

    if (!teacher) {
      return;
    }

    const center = await processCenter(scrapedTalk, ctx).catch((error) => {
      if (scrapedTalk.centerSubdomain) {
        ctx.stats.centers.failed.push({
          error: error instanceof Error ? error.message : "Unknown error",
          id: 0,
          title: scrapedTalk.center ?? "Unknown center",
        });
      }
      logger.error("Failed to process center", error as Error, {
        center: scrapedTalk.center,
        talkId: scrapedTalk.talkId,
      });
      return null;
    });

    const retreat = await processRetreat(scrapedTalk, ctx).catch((error) => {
      if (scrapedTalk.retreatId) {
        ctx.stats.retreats.failed.push({
          error: error instanceof Error ? error.message : "Unknown error",
          id: scrapedTalk.retreatId,
          title: scrapedTalk.retreat ?? "Unknown retreat",
        });
      }
      logger.error("Failed to process retreat", error as Error, {
        retreat: scrapedTalk.retreat,
        talkId: scrapedTalk.talkId,
      });
      return null;
    });

    const normalizedAudioUrl = normalizeAudioUrl(scrapedTalk.audioUrl);

    if (!normalizedAudioUrl) {
      logger.warn("Skipping talk without audio URL", {
        talkId: scrapedTalk.talkId,
        title: scrapedTalk.title,
      });
      return;
    }

    await ctx.drizzleDb
      .insert(talks)
      .values({
        title: scrapedTalk.title,
        slug: slugify(scrapedTalk.title, scrapedTalk.talkId),
        description: scrapedTalk.description,
        audioUrl: normalizedAudioUrl,
        externalGuid: `dharmaseed-talk-${scrapedTalk.talkId}`,
        teacherId: teacher.id,
        centerId: center?.id ?? null,
        retreatId: retreat?.id ?? null,
        dharmaSeedId: scrapedTalk.talkId,
        duration: sumTime(scrapedTalk.time),
        publicationDate: new Date(scrapedTalk.date),
        createdAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: talks.dharmaSeedId,
        set: {
          centerId: center?.id ?? null,
          description: scrapedTalk.description,
          duration: sumTime(scrapedTalk.time),
          retreatId: retreat?.id ?? null,
          slug: slugify(scrapedTalk.title, scrapedTalk.talkId),
          teacherId: teacher.id,
          title: scrapedTalk.title,
          audioUrl: normalizedAudioUrl,
          publicationDate: new Date(scrapedTalk.date),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    ctx.stats.talks.processed++;
  } catch (error) {
    ctx.stats.talks.failed.push({
      error: error instanceof Error ? error.message : "Unknown error",
      id: scrapedTalk.talkId,
      title: scrapedTalk.title,
    });
    logger.error("Failed to process talk", error as Error, {
      talkId: scrapedTalk.talkId,
      title: scrapedTalk.title,
    });
  }
}

const processBatch = async <T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  options: { batchSize: number },
) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += options.batchSize) {
    chunks.push(items.slice(index, index + options.batchSize));
  }

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(processor));
  }
};

export const syncTalks = async (
  database: D1Database,
  options: SyncTalksOptions = {},
): Promise<SyncExecutionResult> => {
  const drizzleDb = db(database);
  const stats = createEmptyStats();
  const ctx: ProcessTalkContext = { drizzleDb, stats };
  const startTime = Date.now();
  const {
    maxPages,
    mode = "incremental",
    skipProcessing = false,
  } = options;

  logger.info("Starting sync", { maxPages, mode, skipProcessing });

  const fetchStats = await fetchTalksFromDharmaseed(
    database,
    async (pageTalks) => {
      await processBatch(pageTalks, (talk) => processTalk(talk, ctx), {
        batchSize: 10,
      });
    },
    {
      maxPages,
      mode,
      skipProcessing,
    },
  );

  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);

  logger.info("Sync statistics", {
    centers: stats.centers,
    duration: `${minutes}m ${seconds}s`,
    fetchStats,
    retreats: stats.retreats,
    talks: stats.talks,
    teachers: stats.teachers,
  });

  return {
    failedCount:
      stats.talks.failed.length +
      stats.teachers.failed.length +
      stats.retreats.failed.length +
      stats.centers.failed.length,
    job: "syncTalks",
    meta: {
      centers: stats.centers,
      durationMs: duration,
      fetchStats,
      maxPages: maxPages ?? null,
      mode,
      retreats: stats.retreats,
      talks: stats.talks,
      teachers: stats.teachers,
    },
    processedCount: stats.talks.processed,
    status:
      stats.talks.failed.length > 0 ||
      stats.teachers.failed.length > 0 ||
      stats.retreats.failed.length > 0 ||
      stats.centers.failed.length > 0
        ? "failure"
        : "success",
  };
};

export const upsertScrapedTalk = async (
  database: D1Database,
  scrapedTalk: ScrapedTalk,
) => {
  const stats = createEmptyStats();
  await processTalk(scrapedTalk, {
    drizzleDb: db(database),
    stats,
  });
  return stats;
};
