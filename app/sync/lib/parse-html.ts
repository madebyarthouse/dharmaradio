import { parseHTML } from "linkedom";
import type { ScrapedTalk } from "./types";
import { Logger } from "./logger";

const logger = new Logger("parse-html");

export const parseTalksFromHtml = (html: string): ScrapedTalk[] => {
  const { document } = parseHTML(html);
  const talkElements = document.querySelectorAll(".talklist > table");
  const talks: ScrapedTalk[] = [];

  for (let i = 0; i < talkElements.length; i++) {
    const talk = talkElements[i];
    if (!talk) continue;

    const rows = talk.querySelectorAll("tr");
    const titleRow = rows[0];
    const teacherRow = rows[1];

    // Check if there's a description
    const hasDescription = rows[2]?.querySelector(".talk-description") !== null;
    const descriptionRow = hasDescription ? rows[2] : null;
    const linksRow = hasDescription ? rows[3] : rows[2];

    // Parse title and talk ID
    const titleLink = titleRow?.querySelector("a.talkteacher");
    const title = titleLink?.textContent?.trim() ?? "";
    const talkId = titleLink?.getAttribute("href")?.split("/").pop() ?? "0";

    // Parse teacher info
    const teacherLink = teacherRow?.querySelector(".talkteacher");
    const teacher = teacherLink?.textContent?.trim() ?? "";
    const teacherUrl = teacherLink?.getAttribute("href") ?? null;

    // Parse time and date
    const time = titleRow?.querySelector("i")?.textContent?.trim() ?? "";
    const date = titleRow?.textContent?.trim()?.split(" ")[0]?.trim() ?? "";

    // Parse description (if exists)
    const description = descriptionRow?.textContent?.trim() ?? null;

    // Parse center and retreat links
    const centerText = linksRow?.textContent?.trim() ?? "";
    const links = linksRow?.querySelectorAll("a") ?? [];

    // The first link is always the center
    const centerLink = links[0];
    const center = centerLink?.textContent?.trim() ?? null;
    const centerUrl = centerLink?.getAttribute("href") ?? null;
    const centerSubdomain =
      centerUrl?.split(".")[0].replace("https://", "") ?? null;

    // The retreat link might be wrapped in an <i> tag
    const retreatLink = links[1];
    const retreat =
      retreatLink?.querySelector("i")?.textContent?.trim() ??
      retreatLink?.textContent?.trim() ??
      null;
    const retreatUrl = retreatLink?.getAttribute("href") ?? null;
    const retreatId = retreatUrl
      ? parseInt(retreatUrl.split("/retreats/").pop()?.replace("/", "") ?? "0")
      : null;

    // Parse audio URL
    const audioUrl =
      talk.querySelector(".talkbutton a")?.getAttribute("href") ?? null;

    // Validate required fields
    if (!talkId || !title || !teacher || !time || !date) {
      console.warn("Skipping invalid talk:", {
        title,
        teacher,
        time,
        date,
        talkId,
      });
      continue;
    }

    // Log problematic talks for debugging
    if (!retreatId && centerText.includes("retreat")) {
      logger.warn("Failed to parse retreat ID", {
        html: linksRow?.innerHTML,
        centerText,
        retreat,
        retreatUrl,
        title,
      });
    }

    talks.push({
      title,
      teacher,
      teacherUrl,
      description,
      center,
      centerUrl,
      retreat,
      retreatUrl,
      date,
      time,
      audioUrl,
      talkId: parseInt(talkId),
      centerSubdomain,
      retreatId,
    });
  }
  return talks;
};
