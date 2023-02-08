// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import { promises as fs } from "fs";
import { prisma } from "~/lib/prisma.server";
import { z } from "zod";
import { batchPrismaTransactions } from "~/utils/batching";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  //Find the absolute path of the json directory
  const jsonDirectory = path.join(process.cwd(), "src/data");
  const fileContents = await fs.readFile(
    jsonDirectory + "/retreats-bootstrap-output.json",
    "utf8"
  );

  const retreats = RetreatJSONValidator.parse(JSON.parse(fileContents));

  for (const retreatData of retreats) {
    const retreat = await prisma.retreat.upsert({
      where: {
        dharmaSeedId: retreatData.retreat.dharmaSeedId,
      },
      update: {},
      create: {
        title: retreatData.retreat.title,
        description: retreatData.retreat.description,
        language: retreatData.retreat.language,
        date: new Date(retreatData.retreat.date),
        lastBuildDate: new Date(retreatData.retreat.lastBuildDate),
        dharmaSeedId: retreatData.retreat.dharmaSeedId,
      },
    });

    console.log(`${retreat.title} created`);

    await batchPrismaTransactions(
      retreatData.talkIds.map((talkId) => {
        return prisma.talk.update({
          where: { id: talkId },
          data: {
            retreat: {
              connect: {
                id: retreat.id,
              },
            },
          },
        });
      }),
      10
    );
  }

  res.status(200).json({ success: true });
}

export const RetreatJSONValidator = z.array(
  z.object({
    retreat: z.object({
      title: z.string(),
      profileImageUrl: z.string(),
      description: z.string(),
      language: z.string(),
      date: z.string(),
      lastBuildDate: z.string(),
      dharmaSeedId: z.number(),
    }),
    talkIds: z.array(z.number()),
  })
);
