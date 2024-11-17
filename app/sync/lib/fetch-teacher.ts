import { parseTeacherFromHtml, type ScrapedTeacher } from "./parse-teacher";
import { dharmaSeedBase } from "./utils";

export async function fetchTeacherFromDharmaseed(
  teacherId: number
): Promise<ScrapedTeacher> {
  const url = `${dharmaSeedBase}/teacher/${teacherId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch teacher ${teacherId}: ${response.status}`);
  }

  const html = await response.text();
  return parseTeacherFromHtml(html, teacherId);
}
