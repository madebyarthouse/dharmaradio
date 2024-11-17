import { type D1Database } from "@cloudflare/workers-types";
import { db } from "../db/client.server";
import { teachers } from "../db/schema";
import { fetchTeachersListFromDharmaseed } from "./lib/fetch-teachers-list";
import { slugify } from "./lib/utils";
import { sql } from "drizzle-orm";
import { Logger } from "./lib/logger";

const logger = new Logger("sync-teachers");

export async function syncTeachers(database: D1Database) {
  const drizzleDb = db(database);
  const startTime = Date.now();

  try {
    logger.info("Starting teacher sync");

    const teachersList = await fetchTeachersListFromDharmaseed();
    logger.info(`Found ${teachersList.length} teachers`);

    // Process all teachers
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

        logger.debug(`Processed teacher ${teacher.name}`);
      } catch (error) {
        logger.error(
          `Failed to process teacher ${teacher.name}`,
          error as Error
        );
      }
    }
  } catch (error) {
    logger.error("Sync encountered errors", error as Error);
  } finally {
    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(0);

    logger.info("Sync completed", {
      duration: `${minutes}m ${seconds}s`,
    });
  }
}
