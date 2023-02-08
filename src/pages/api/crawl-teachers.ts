// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import path from "path";
import { promises as fs } from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import Parser from "rss-parser";
import { TeacherRSSFeedValidator } from "~/services/validators/teacher-rss-feed-validator";
import { TeacherRSSFeed } from "../../services/validators/teacher-rss-feed-validator";
import { batchExecute } from "~/utils/batching";

const parser: Parser = new Parser({
  timeout: 1000 * 60, // 60 seconds
});

const parseDurationToSeconds = (duration: string) => {
  const parts = duration.split(":");
  const seconds = parts.length > 0 ? parseInt(parts[parts.length - 1]) : 0;
  const minutes = parts.length > 1 ? parseInt(parts[parts.length - 2]) : 0;
  const hours = parts.length > 2 ? parseInt(parts[parts.length - 3]) : 0;

  return seconds + minutes * 60 + hours * 60 * 60;
};

const parseFeed = async (feed: string) => {
  console.log(feed);
  try {
    const rssFeed = await parser.parseURL(feed);

    //   const parsed = await TeacherRSSFeedValidator.parse(rssFeed);
    const parsed = rssFeed as unknown as TeacherRSSFeed;

    const teacher = {
      name: parsed.title
        .replace("Dharma Seed - dharmaseed.org: ", "")
        .replace("'s most recent Dharma talks", ""),
      profileImageUrl: parsed.itunes.image,
      description: parsed.description,
      language: parsed.language,
      lastBuildDate: new Date(parsed.lastBuildDate),
      dharmaSeedId: parseInt(
        parsed.feedUrl
          .replace("https://dharmaseed.org/feeds/teacher/", "")
          .replace("/?max-entries=all", "")
      ),
    };

    const talks = parsed.items.map((item) => {
      return {
        title: item.title,
        link: item.link,
        description: item.content,
        dharmaSeedId: parseInt(
          item.link
            .replace("https://dharmaseed.org/talks/", "")
            .replace("/", "")
        ),
        audioUrl: item.enclosure.url,
        location: item.contentSnippet,
        guid: item.guid,
        isoDate: new Date(item.isoDate),
        duration: parseDurationToSeconds(item.itunes.duration),
      };
    });

    return {
      teacher,
      talks,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  //Find the absolute path of the json directory
  const jsonDirectory = path.join(process.cwd(), "src/data");
  const fileContents = await fs.readFile(
    jsonDirectory + "/teacher-feed-urls.json",
    "utf8"
  );

  const feeds = z.array(z.string()).parse(JSON.parse(fileContents));

  console.time();
  const parsedTeacherFeeds = await batchExecute(feeds, parseFeed, 20);
  console.timeEnd();

  console.log(
    parsedTeacherFeeds.length,
    parsedTeacherFeeds.filter(Boolean).length
  );

  await fs.writeFile(
    jsonDirectory + "/teacher-bootstrap-output.json",
    JSON.stringify(parsedTeacherFeeds, null, 2)
  );

  res.status(200).json({ parsed: parsedTeacherFeeds.length });
}
