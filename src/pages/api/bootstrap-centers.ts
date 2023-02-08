// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import path from "path";
import { promises as fs } from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { JSDOM } from "jsdom";
import { prisma } from "~/lib/prisma.server";
import { batchPrismaTransactions } from "~/utils/batching";

const scrapeWebsiteLinkFromCenterWebsite = async (websiteUrl: string) => {
  const html = await fetch(websiteUrl + "/talks").then((res) => res.text());
  const dom = new JSDOM(html);
  const websiteLink = dom.window.document.querySelector(
    ".navmenu .navitems li:nth-child(4) > a"
  );
  console.log(websiteLink?.getAttribute("href"));
  return websiteLink?.getAttribute("href") ?? null;
};

const bootstrapCenter = async (data: { name: string; url: string }) => {
  const website = await scrapeWebsiteLinkFromCenterWebsite(data.url);

  const center = await prisma.center.upsert({
    where: { name: data.name },
    update: {},
    create: {
      name: data.name,
      websiteUrl: website,
      dharmaSeedSubdomain: data.url
        .replace("https://", "")
        .replace(".dharmaseed.org", ""),
    },
  });

  const talksWithCenterNameInDescription = await prisma.talk.findMany({
    where: {
      description: {
        contains: data.name,
      },
    },
  });

  await batchPrismaTransactions(
    talksWithCenterNameInDescription.map((talk) => {
      return prisma.talk.update({
        where: { id: talk.id },
        data: {
          center: {
            connect: {
              id: center.id,
            },
          },
        },
      });
    }),
    10
  );
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  //Find the absolute path of the json directory
  const jsonDirectory = path.join(process.cwd(), "src/data");
  const fileContents = await fs.readFile(
    jsonDirectory + "/center-names-and-urls.json",
    "utf8"
  );

  const centers = z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
      })
    )
    .parse(JSON.parse(fileContents));

  console.time("total");
  for (const centerData of centers) {
    await bootstrapCenter(centerData);
    break;
  }
  console.timeEnd("total");

  res.status(200).json({ success: true });
}
