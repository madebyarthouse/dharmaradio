import { Metadata } from "next";
import Link from "next/link";
import Heading from "~/app/ui/heading";
import Item from "~/app/ui/item";
import { prisma } from "~/lib/prisma.server";

export const metadata: Metadata = {
  title: "Talks",
  description: "Meditation talks",
};

export default async function TeachersPage({}) {
  const latestTeachers = await prisma.teacher.findMany({
    orderBy: {
      name: "asc",
    },
    take: 10,
  });

  return (
    <div>
      <Heading level="h1">Teachers</Heading>
      <hr />
      <ul className="grid grid-cols-3 gap-5">
        {latestTeachers.map((teacher) => (
          <li key={teacher.id}>
            <Item
              layout="grid"
              href={`/teachers/${teacher.slug}`}
              title={teacher.name}
              text={teacher.description}
              mediaUrl={teacher.profileImageUrl}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
