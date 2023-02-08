// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import path from "path";
import { promises as fs } from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import Parser from "rss-parser";
import type { RetreatRSSFeed } from "~/services/validators/retreat-rss-feed-validator";
import { batchExecute } from "~/utils/batching";

const parser: Parser = new Parser({
  timeout: 1000 * 60, // 60 seconds
});

const extractDateFromRetreatTitle = (title: string) => {
  const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[0]; // I love you copilot <3
  return date ? new Date(date) : null;
};

const parseRetreatFeed = async (retreatId: number) => {
  console.log(RETREAT_BASE_URL + retreatId);
  try {
    const rssFeed = await parser.parseURL(RETREAT_BASE_URL + retreatId);

    //   const parsed = await RetreatRSSFeedValidator.parse(rssFeed);
    const parsed = rssFeed as unknown as RetreatRSSFeed;

    const retreat = {
      title: parsed.title
        .replace("Dharma Seed - dharmaseed.org: ", "")
        .replace("'s most recent Dharma talks", ""),
      profileImageUrl: parsed.itunes.image,
      description: parsed.description,
      language: parsed.language,
      date: extractDateFromRetreatTitle(parsed.title),
      lastBuildDate: new Date(parsed.lastBuildDate),
      dharmaSeedId: retreatId,
    };

    const talkIds = parsed.items.map((item) =>
      parseInt(
        item.link.replace("https://dharmaseed.org/talks/", "").replace("/", "")
      )
    );

    return {
      retreat,
      talkIds,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};

const RETREAT_BASE_URL = "https://dharmaseed.org/feeds/retreat/";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  //Find the absolute path of the json directory
  const jsonDirectory = path.join(process.cwd(), "src/data");
  const fileContents = await fs.readFile(
    jsonDirectory + "/retreat-ids.json",
    "utf8"
  );

  const feeds = z.array(z.number()).parse(JSON.parse(fileContents));

  console.time("total");
  const parsedTeacherFeeds = await batchExecute(feeds, parseRetreatFeed, 20);
  console.timeEnd("total");

  console.log(
    parsedTeacherFeeds.length,
    parsedTeacherFeeds.filter(Boolean).length
  );

  await fs.writeFile(
    jsonDirectory + "/retreats-bootstrap-output.json",
    JSON.stringify(parsedTeacherFeeds, null, 2)
  );

  res.status(200).json({ parsed: parsedTeacherFeeds.length });
}
