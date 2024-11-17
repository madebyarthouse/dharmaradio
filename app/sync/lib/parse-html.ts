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

    const parsedLinks = Array.from(links).map((link) => ({
      text: link.textContent?.trim() ?? null,
      url: link.getAttribute("href") ?? null,
    }));

    const centerData = parsedLinks.find(
      (link) => !link.url?.includes("retreats")
    );
    const retreatData = parsedLinks.find((link) =>
      link.url?.includes("retreats")
    );

    const center = centerData?.text ?? null;
    const centerUrl = centerData?.url ?? null;
    const centerSubdomain =
      centerUrl?.split(".")[0].replace("https://", "") ?? null;

    const retreat = retreatData?.text ?? null;
    const retreatUrl = retreatData?.url ?? null;
    const retreatId = retreatUrl
      ? parseInt(retreatUrl.split("/retreats/").pop()?.replace("/", "") ?? "0")
      : null;

    if (!retreatId) {
      console.debug({
        links: linksRow?.innerHTML,
        retreat,
        retreatUrl,
        centerUrl,
        title,
        talkId,
      });
    }

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
