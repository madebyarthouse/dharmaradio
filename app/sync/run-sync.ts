import { and, desc, eq, lt } from "drizzle-orm";
import { bumpCacheEpoch } from "~/lib/cache.server";
import { db } from "~/db/client.server";
import { syncTalks } from "./sync-to-db";
import { syncTeachers } from "./sync-teachers";
import type { SyncExecutionResult } from "./types";
import { syncRuns } from "~/db/schema";

export type SyncJob = "syncTalks" | "syncTeachers";
type SyncRunStatus = SyncExecutionResult["status"] | "abandoned" | "running" | "skipped";

export type SyncJobResult = Omit<SyncExecutionResult, "status"> & {
  cacheEpoch?: string;
  runId?: number;
  status: SyncRunStatus;
};

const RECENT_SYNC_MAX_PAGES = 10;
const RUN_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

type SyncTrigger = {
  cron?: string;
  type: "scheduled";
};

type SyncRunRecord = typeof syncRuns.$inferSelect;

const baseRunMeta = (
  job: SyncJob,
  trigger: SyncTrigger,
): Record<string, unknown> => ({
  cron: trigger.cron ?? null,
  pageLimit: RECENT_SYNC_MAX_PAGES,
  trigger: trigger.type,
  triggerJob: job,
});

const readRunMeta = (run: Pick<SyncRunRecord, "metaJson">): Record<string, unknown> => {
  try {
    return JSON.parse(run.metaJson) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const createSyncRun = async (
  database: D1Database,
  job: SyncJob,
  startedAt: Date,
  trigger: SyncTrigger,
) => {
  const run = await db(database)
    .insert(syncRuns)
    .values({
      durationMs: 0,
      failedCount: 0,
      finishedAt: startedAt,
      job,
      metaJson: JSON.stringify(baseRunMeta(job, trigger)),
      processedCount: 0,
      startedAt,
      status: "running",
    })
    .returning({ id: syncRuns.id })
    .get();

  if (!run) {
    throw new Error(`Failed to create sync run for ${job}`);
  }

  return run.id;
};

const finalizeSyncRun = async (
  database: D1Database,
  runId: number,
  result: SyncJobResult,
  startedAt: Date,
) => {
  const finishedAt = new Date();
  await db(database)
    .update(syncRuns)
    .set({
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      failedCount: result.failedCount,
      finishedAt,
      metaJson: JSON.stringify(result.meta),
      processedCount: result.processedCount,
      status: result.status,
    })
    .where(eq(syncRuns.id, runId));
};

const getLatestRunningRun = async (database: D1Database, job: SyncJob) =>
  db(database)
    .select()
    .from(syncRuns)
    .where(and(eq(syncRuns.job, job), eq(syncRuns.status, "running")))
    .orderBy(desc(syncRuns.startedAt))
    .get();

const markStaleRunningRunsAsAbandoned = async (
  database: D1Database,
  job: SyncJob,
  now: Date,
) => {
  const staleRuns = await db(database)
    .select()
    .from(syncRuns)
    .where(
      and(
        eq(syncRuns.job, job),
        eq(syncRuns.status, "running"),
        lt(syncRuns.startedAt, new Date(now.getTime() - RUN_STALE_AFTER_MS)),
      ),
    )
    .all();

  for (const staleRun of staleRuns) {
    const meta = readRunMeta(staleRun);
    await db(database)
      .update(syncRuns)
      .set({
        durationMs: now.getTime() - staleRun.startedAt.getTime(),
        failedCount: staleRun.failedCount,
        finishedAt: now,
        metaJson: JSON.stringify({
          ...meta,
          abandonedAt: now.toISOString(),
          abandonedReason: "stale_running_run",
        }),
        processedCount: staleRun.processedCount,
        status: "abandoned",
      })
      .where(eq(syncRuns.id, staleRun.id));
  }
};

const createSkippedResult = (
  job: SyncJob,
  reason: string,
  meta: Record<string, unknown>,
): SyncJobResult => ({
  failedCount: 0,
  job,
  meta: {
    ...meta,
    skipReason: reason,
  },
  processedCount: 0,
  status: "skipped",
});

export const runSyncJob = async (
  job: SyncJob,
  env: Env,
  trigger: SyncTrigger = { type: "scheduled" },
): Promise<SyncJobResult> => {
  const startedAt = new Date();
  await markStaleRunningRunsAsAbandoned(env.DB, job, startedAt);

  const activeRun = await getLatestRunningRun(env.DB, job);
  if (activeRun) {
    const result = createSkippedResult(job, "another_run_is_active", {
      ...baseRunMeta(job, trigger),
      activeRunId: activeRun.id,
      activeRunStartedAt: activeRun.startedAt.toISOString(),
    });
    const skippedRunId = await createSyncRun(env.DB, job, startedAt, trigger);
    result.runId = skippedRunId;
    await finalizeSyncRun(env.DB, skippedRunId, result, startedAt);
    return result;
  }

  const runId = await createSyncRun(env.DB, job, startedAt, trigger);

  try {
    const baseResult =
      job === "syncTeachers"
        ? await syncTeachers(env.DB, { maxPages: RECENT_SYNC_MAX_PAGES })
        : await syncTalks(env.DB, {
            maxPages: RECENT_SYNC_MAX_PAGES,
            mode: "incremental",
            skipProcessing: false,
          });

    const shouldInvalidateCache = baseResult.processedCount > 0;
    const cacheEpoch = shouldInvalidateCache
      ? await bumpCacheEpoch(env.DB_QUERY_CACHE)
      : undefined;
    const talkFetchStats =
      job === "syncTalks" &&
      baseResult.meta.fetchStats &&
      typeof baseResult.meta.fetchStats === "object"
        ? (baseResult.meta.fetchStats as {
            lastPageNewTalkCount?: number;
            reachedPageLimit?: boolean;
            stopReason?: string;
          })
        : null;
    const manualCatchUpRecommended =
      job === "syncTalks" &&
      talkFetchStats?.reachedPageLimit === true &&
      (talkFetchStats.lastPageNewTalkCount ?? 0) > 0;
    const result: SyncJobResult = {
      ...baseResult,
      cacheEpoch,
      meta: {
        ...baseRunMeta(job, trigger),
        ...baseResult.meta,
        cacheEpoch: cacheEpoch ?? null,
        cacheInvalidated: shouldInvalidateCache && Boolean(env.DB_QUERY_CACHE),
        localCatchUpRecommended: manualCatchUpRecommended,
        runId,
      },
      runId,
    };

    await finalizeSyncRun(env.DB, runId, result, startedAt);
    return result;
  } catch (error) {
    const result: SyncJobResult = {
      failedCount: 1,
      job,
      meta: {
        ...baseRunMeta(job, trigger),
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        runId,
      },
      processedCount: 0,
      status: "failure",
      runId,
    };

    await finalizeSyncRun(env.DB, runId, result, startedAt);
    throw error;
  }
};
