import { parseHTML } from "linkedom";
import fs from "fs/promises";
import path from "path";

type Talk = {
  title: string;
  teacher: string;
  description: string | null;
  center: string | null;
  centerUrl: string | null;
  retreat: string | null;
  retreatUrl: string | null;
  date: string;
  time: string;
  audioUrl: string | null;
  sizeInBytes?: string;
};

const dharmaSeedBase = "https://dharmaseed.org";
const urlForPage = (page: number) =>
  `${dharmaSeedBase}/talks/?page=${page}&search=&sort=-rec_date&page_items=100`;
const outputFileName = path.join(process.cwd(), "talks.json");

const setupOutputFile = async (): Promise<void> => {
  try {
    await fs.access(outputFileName);
  } catch {
    await fs.writeFile(outputFileName, "[]");
  }
};

const parseTalksFromHtml = (html: string): Talk[] => {
  const { document } = parseHTML(html);
  const talkElements = document.querySelectorAll(".talklist > table");
  const talks: Talk[] = [];

  for (let i = 0; i < talkElements.length; i++) {
    const talk = talkElements[i];
    if (!talk) continue;

    const firstline = talk.querySelectorAll("tr")[0];
    const secondline = talk.querySelectorAll("tr")[1];
    const thirdline = talk.querySelectorAll("tr")[2]?.textContent?.trim();
    const fourthline = talk.querySelectorAll("tr")[3]?.querySelectorAll("a");

    const title =
      talk
        .querySelector("tr:first-child .talkteacher")
        ?.textContent?.replace("\b", "")
        .trim() ?? "";

    const teacher =
      secondline?.querySelector(".talkteacher")?.textContent?.trim() ?? "";

    const time = firstline?.querySelector("i")?.textContent?.trim() ?? "";
    const date = firstline?.textContent?.trim()?.split(" ")[0]?.trim() ?? "";
    const description = thirdline?.trim() ?? null;

    const center = fourthline?.[0]?.textContent?.trim() ?? null;
    const centerUrl = fourthline?.[0]?.getAttribute("href") ?? null;

    const retreat = fourthline?.[1]?.textContent?.trim() ?? null;
    const retreatUrl = fourthline?.[1]?.getAttribute("href") ?? null;

    const audioUrl =
      talk.querySelector(".talkbutton a")?.getAttribute("href") ?? null;

    talks.push({
      title,
      teacher,
      description,
      center,
      centerUrl,
      retreat,
      retreatUrl,
      date,
      time,
      audioUrl,
    });
  }
  return talks;
};

const fetchTalksFromDharmaseed = async (maxPages?: number) => {
  const talks = [];
  let page = 1;
  let morePages = true;
  let retries = 0;
  while (morePages) {
    let success = false;
    while (!success && retries < 3) {
      try {
        const response = await fetch(urlForPage(page));
        const html = await response.text();
        const newTalks = parseTalksFromHtml(html);
        console.log(`Page ${page}: ${newTalks.length} talks.`);
        talks.push(...newTalks);

        const reachedMaxPages = maxPages ? page >= maxPages : true;
        morePages = newTalks.length > 0 && reachedMaxPages;
        success = true;
      } catch (e) {
        console.error(
          `Error fetching page ${page}. Waiting 3s and retrying.`,
          e
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        retries++;
      }
    }

    page++;
  }
  return talks;
};

const fetchTalksFromJson = async () => {
  try {
    const talks = await fs.readFile(outputFileName, "utf-8");
    return JSON.parse(talks);
  } catch (e) {
    return [];
  }
};

const sumTime = (time: string) => {
  const timeParts = time.split(":");
  if (timeParts.length === 2) {
    const [minutes, seconds] = timeParts;
    return parseInt(minutes) + parseInt(seconds) / 60;
  }

  if (timeParts.length === 3) {
    const [hours, minutes, seconds] = timeParts;
    return parseInt(hours) * 60 + parseInt(minutes) + parseInt(seconds) / 60;
  }

  console.log(`Invalid time for talk: ${time}`, time);
  return 0;
};

const main = async () => {
  await setupOutputFile();

  const jsonTalks = await fetchTalksFromJson();
  const talksMeta =
    jsonTalks.length > 0 ? jsonTalks : await fetchTalksFromDharmaseed();

  talksMeta.forEach((talk: Talk) => {
    if (talk.audioUrl && !talk.audioUrl.startsWith("http")) {
      talk.audioUrl = `${dharmaSeedBase}${talk.audioUrl}`;
    }
  });

  console.log(`Fetched ${talksMeta.length} talks.`);
  console.log("Writing talks to file...");

  await fs.writeFile(outputFileName, JSON.stringify(talksMeta, null, 2));

  // Add analysis that uses sumTime
  const totalTime = talksMeta.reduce((acc: number, talk: Talk) => {
    return acc + sumTime(talk.time);
  }, 0);

  console.log(`Total duration: ${Math.floor(totalTime)} minutes`);
};

if (require.main === module) {
  main().catch((error) => {
    console.error("Error running scraper:", error);
    process.exit(1);
  });
}
