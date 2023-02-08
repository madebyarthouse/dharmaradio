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
    jsonDirectory + "/teacher-bootstrap-output.json",
    "utf8"
  );

  const teacherFeeds = TeacherJSONValidator.parse(JSON.parse(fileContents));

  for (const teacherFeed of teacherFeeds) {
    const teacher = await prisma.teacher.upsert({
      where: {
        dharmaSeedId: teacherFeed.teacher.dharmaSeedId,
      },
      update: {},
      create: {
        name: teacherFeed.teacher.name,
        profileImageUrl: teacherFeed.teacher.profileImageUrl,
        description: teacherFeed.teacher.description,
        language: teacherFeed.teacher.language,
        lastBuildDate: teacherFeed.teacher.lastBuildDate,
        dharmaSeedId: teacherFeed.teacher.dharmaSeedId,
      },
    });

    console.log(`${teacher.name} created`);

    await batchPrismaTransactions(
      teacherFeed.talks.map((talk) => {
        return prisma.talk.upsert({
          where: {
            dharmaSeedId: talk.dharmaSeedId,
          },
          update: {},
          create: {
            title: talk.title.replace(`${teacher.name}: `, ""),
            description: talk.description,
            dharmaSeedId: talk.dharmaSeedId,
            audioUrl: talk.audioUrl,
            externalGuid: talk.guid,
            publicationDate: talk.isoDate,
            duration: talk.duration,
            teacher: {
              connect: {
                id: teacher.id,
              },
            },
          },
        });
      }),
      20
    );
  }

  res.status(200).json({ success: true });
}

export const TeacherJSONValidator = z.array(
  z.object({
    teacher: z.object({
      name: z.string(),
      profileImageUrl: z.string(),
      description: z.string(),
      language: z.string(),
      lastBuildDate: z.string(),
      dharmaSeedId: z.number(),
    }),
    talks: z.array(
      z.object({
        title: z.string(),
        link: z.string(),
        description: z.string(),
        dharmaSeedId: z.number(),
        audioUrl: z.string(),
        location: z.string(),
        guid: z.string(),
        isoDate: z.string(),
        duration: z.number(),
      })
    ),
  })
);
