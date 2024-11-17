import {
  parseTeachersFromHtml,
  type ScrapedTeacher,
} from "./parse-teachers-list";
import { dharmaSeedBase } from "./utils";
import { Logger } from "./logger";
import { withRetry } from "./retry";

const logger = new Logger("fetch-teachers-list");

export async function fetchTeachersListFromDharmaseed(): Promise<
  ScrapedTeacher[]
> {
  const teachers: ScrapedTeacher[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = `${dharmaSeedBase}/teachers/?page=${page}&page_items=100`;

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res;
        },
        {
          maxAttempts: 3,
          initialDelay: 3000,
          maxDelay: 10000,
        }
      );

      const html = await response.text();
      const pageTeachers = parseTeachersFromHtml(html);

      if (pageTeachers.length === 0) {
        hasMorePages = false;
      } else {
        teachers.push(...pageTeachers);
        logger.info(`Fetched page ${page}`, {
          teacherCount: pageTeachers.length,
        });
        page++;
        // Add a small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Failed to fetch page ${page}`, error as Error);
      throw error;
    }
  }

  logger.info("Successfully fetched all teachers", {
    totalTeachers: teachers.length,
    pages: page - 1,
  });

  return teachers;
}
