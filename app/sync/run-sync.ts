import { bumpCacheEpoch } from "~/lib/cache.server";
import { db } from "~/db/client.server";
import { syncTalks } from "./sync-to-db";
import { syncTeachers } from "./sync-teachers";
import type { SyncExecutionResult } from "./types";
import { syncRuns } from "~/db/schema";

export type SyncJob = "syncTalks" | "syncTeachers";
export type SyncJobResult = SyncExecutionResult & {
  cacheEpoch?: string;
};

const persistSyncRun = async (
  database: D1Database,
  result: SyncJobResult,
  startedAt: Date,
) => {
  const finishedAt = new Date();
  await db(database).insert(syncRuns).values({
    job: result.job,
    status: result.status,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    processedCount: result.processedCount,
    failedCount: result.failedCount,
    metaJson: JSON.stringify(result.meta),
  });
};

export const runSyncJob = async (
  job: SyncJob,
  env: Env,
): Promise<SyncJobResult> => {
  const startedAt = new Date();

  try {
    const baseResult =
      job === "syncTeachers"
        ? await syncTeachers(env.DB)
        : await syncTalks(env.DB, false);

    const cacheEpoch = await bumpCacheEpoch(env.DB_QUERY_CACHE);
    const result: SyncJobResult = {
      ...baseResult,
      cacheEpoch,
      meta: {
        ...baseResult.meta,
        cacheInvalidated: Boolean(env.DB_QUERY_CACHE),
        cacheEpoch,
      },
    };

    await persistSyncRun(env.DB, result, startedAt);
    return result;
  } catch (error) {
    const result: SyncJobResult = {
      failedCount: 1,
      job,
      meta: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      processedCount: 0,
      status: "failure",
    };

    await persistSyncRun(env.DB, result, startedAt);
    throw error;
  }
};
