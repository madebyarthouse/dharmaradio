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
) => {
  switch (job) {
    case "syncTalks":
    case "syncTeachers":
      return runSyncJob(job, env);
    default: {
      const exhaustive: never = job;
      throw new Error(`Unknown cron job: ${exhaustive}`);
    }
  }
};
