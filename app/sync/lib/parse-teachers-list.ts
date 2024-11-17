import { parseHTML } from "linkedom";

export type ScrapedTeacher = {
  name: string;
  dharmaSeedId: number;
  description: string | null;
  profileImageUrl: string | null;
  websiteUrl: string | null;
  donationUrl: string | null;
};

export function parseTeachersFromHtml(html: string): ScrapedTeacher[] {
  const { document } = parseHTML(html);
  const teachers: ScrapedTeacher[] = [];

  // Get all teacher tables
  const teacherTables = document.querySelectorAll(".talklist > table");

  for (const table of teacherTables) {
    // Get teacher name and ID from the link
    const teacherLink = table.querySelector("a.talkteacher");
    if (!teacherLink) continue;

    const name = teacherLink.querySelector("b")?.textContent?.trim();
    const href = teacherLink.getAttribute("href");
    if (!name || !href) continue;

    const dharmaSeedId = parseInt(href.split("/").pop() || "0");
    if (!dharmaSeedId) continue;

    // Get description from the italics text
    const description =
      table.querySelector("td i")?.textContent?.trim() ?? null;

    // Get profile image URL
    const imgElement = table.querySelector(
      "img[src^=https://media.dharmaseed.org/uploads/photos/teacher]"
    );
    const profileImageUrl = imgElement?.getAttribute("src") ?? null;

    // Get website and donation links
    const links = table.querySelectorAll(".donate-website-button a");
    let websiteUrl: string | null = null;
    let donationUrl: string | null = null;

    links.forEach((link) => {
      const href = link.getAttribute("href");
      const text = link.textContent?.toLowerCase();
      if (!href || !text) return;

      if (text.includes("website")) {
        websiteUrl = href;
      } else if (text.includes("donate")) {
        donationUrl = href;
      }
    });

    teachers.push({
      name,
      dharmaSeedId,
      description,
      profileImageUrl,
      websiteUrl,
      donationUrl,
    });
  }

  return teachers;
}
