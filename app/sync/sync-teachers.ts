import { sql } from "drizzle-orm";
import { db } from "../db/client.server";
import { teachers } from "../db/schema";
import type { SyncExecutionResult } from "./types";
import { fetchTeachersListFromDharmaseed } from "./lib/fetch-teachers-list";
import { Logger } from "./lib/logger";
import { slugify } from "./lib/utils";

const logger = new Logger("sync-teachers");

export async function syncTeachers(
  database: D1Database,
): Promise<SyncExecutionResult> {
  const drizzleDb = db(database);
  const startTime = Date.now();
  let processedCount = 0;
  const failed: Array<{ error: string; name: string }> = [];

  logger.info("Starting teacher sync");

  const teachersList = await fetchTeachersListFromDharmaseed();
  logger.info(`Found ${teachersList.length} teachers`);

  for (const teacher of teachersList) {
    try {
      await drizzleDb
        .insert(teachers)
        .values({
          name: teacher.name,
          slug: slugify(teacher.name, teacher.dharmaSeedId),
          description: teacher.description,
          profileImageUrl: teacher.profileImageUrl,
          websiteUrl: teacher.websiteUrl,
          donationUrl: teacher.donationUrl,
          dharmaSeedId: teacher.dharmaSeedId,
          publishedOn: sql`CURRENT_TIMESTAMP`,
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .onConflictDoUpdate({
          target: teachers.dharmaSeedId,
          set: {
            name: teacher.name,
            description: teacher.description,
            profileImageUrl: teacher.profileImageUrl,
            websiteUrl: teacher.websiteUrl,
            donationUrl: teacher.donationUrl,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      processedCount++;
      logger.debug(`Processed teacher ${teacher.name}`);
    } catch (error) {
      failed.push({
        name: teacher.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      logger.error(`Failed to process teacher ${teacher.name}`, error as Error);
    }
  }

  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);

  logger.info("Sync completed", {
    duration: `${minutes}m ${seconds}s`,
    failed: failed.length,
    processed: processedCount,
  });

  return {
    failedCount: failed.length,
    job: "syncTeachers",
    meta: {
      durationMs: duration,
      failureDetails: failed.length > 0 ? failed : undefined,
      teacherCount: teachersList.length,
    },
    processedCount,
    status: failed.length > 0 ? "failure" : "success",
  };
}
