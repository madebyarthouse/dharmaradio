import { parseHTML } from "linkedom";

export type ScrapedTeacher = {
  name: string;
  description: string | null;
  profileImageUrl: string | null;
  websiteUrl: string | null;
  donationUrl: string | null;
  dharmaSeedId: number;
};

export const parseTeacherFromHtml = (
  html: string,
  teacherId: number
): ScrapedTeacher => {
  const { document } = parseHTML(html);

  // Get teacher name from the heading
  const nameElement = document.querySelector(".talkteacher b");
  const name = nameElement?.textContent?.trim() ?? "";

  // Get description - it's in italics after the name
  const descriptionElement = document.querySelector("td[align=left] i");
  const description = descriptionElement?.textContent?.trim() ?? null;

  // Get profile image URL
  const profileImageElement = document.querySelector("td[align=center] img");
  const profileImageUrl = profileImageElement?.getAttribute("src") ?? null;

  // Get website and donation links
  const links = document.querySelectorAll(".donate-website-button a");
  let donationUrl: string | null = null;
  let websiteUrl: string | null = null;

  links.forEach((link) => {
    const href = link.getAttribute("href");
    const text = link.textContent?.toLowerCase();

    if (text?.includes("donate")) {
      donationUrl = href ?? null;
    } else if (text?.includes("website")) {
      websiteUrl = href ?? null;
    }
  });

  return {
    name,
    description,
    profileImageUrl,
    websiteUrl,
    donationUrl,
    dharmaSeedId: teacherId,
  };
};
