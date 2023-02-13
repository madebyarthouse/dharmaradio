import { Metadata } from "next";
import Link from "next/link";
import Heading from "~/app/ui/heading";
import Item from "~/app/ui/item";
import { prisma } from "~/lib/prisma.server";

export const metadata: Metadata = {
  title: "Talks",
  description: "Meditation talks",
};

export default async function TalksPage({}) {
  const latestTalks = await prisma.talk.findMany({
    orderBy: {
      publicationDate: "desc",
    },
    take: 10,
  });

  return (
    <div>
      <Heading level="h1">Talks</Heading>
      <hr />
      <ul className="flex flex-col gap-5">
        {latestTalks.map((talk) => (
          <li key={talk.id}>
            <Item
              layout="list"
              href={`/talks/${talk.slug}`}
              title={talk.title}
              text={talk.description}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
