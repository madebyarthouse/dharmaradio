import { runSyncJob, type SyncJob } from "~/sync/run-sync";

export type CronJob = SyncJob;

export const cronScheduleMap: Record<CronJob, string> = {
  syncTalks: "0 */6 * * *",
  syncTeachers: "0 3 * * *",
};

export const runCronJob = async (
  job: CronJob,
  env: Env,
  _ctx: ExecutionContext,
  trigger: { cron?: string; type: "scheduled" } = { type: "scheduled" },
) => {
  switch (job) {
    case "syncTalks":
    case "syncTeachers":
      return runSyncJob(job, env, trigger);
    default: {
      const exhaustive: never = job;
      throw new Error(`Unknown cron job: ${exhaustive}`);
    }
  }
};
