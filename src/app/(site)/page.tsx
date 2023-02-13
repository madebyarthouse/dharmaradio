import Image from "next/image";
import { prisma } from "~/lib/prisma.server";
import Heading from "../ui/heading";
import Item from "../ui/item";

export default async function Home() {
  const [talks, teachers, retreats, centers] = await prisma.$transaction([
    prisma.talk.findMany({
      orderBy: {
        publicationDate: "desc",
      },
      take: 10,
    }),
    prisma.teacher.findMany({
      orderBy: {
        name: "asc",
      },
      take: 10,
    }),
    prisma.retreat.findMany({
      orderBy: {
        date: "desc",
      },
      take: 10,
    }),
    prisma.center.findMany({
      orderBy: {
        name: "asc",
      },
      take: 10,
    }),
  ]);

  return (
    <div>
      <Heading level="h1">Welcome to Dharma Radio</Heading>
      <section>
        <Heading level="h2">Latest talks</Heading>
        <ul className="flex flex-row gap-10 scroll-m-10 w-full overflow-x-auto">
          {talks.map((talk) => (
            <li className="w-[450px]" key={talk.id}>
              <Item
                layout="grid"
                level="h3"
                href={`/talks/${talk.slug}`}
                title={talk.title}
                text={talk.description}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Heading level="h2">Latest retreats</Heading>
        <ul className="flex flex-row gap-10 scroll-m-10 w-full overflow-x-auto">
          {retreats.map((retreat) => (
            <li className="w-[450px]" key={retreat.id}>
              <Item
                layout="grid"
                level="h3"
                href={`/retreats/${retreat.slug}`}
                title={retreat.title}
                text={retreat.description}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Heading level="h2">Teachers</Heading>
        <ul className="flex flex-row gap-10 scroll-m-10 w-full overflow-x-auto">
          {talks.map((teacher) => (
            <li className="w-[450px]" key={teacher.id}>
              <Item
                layout="grid"
                level="h3"
                href={`/teachers/${teacher.slug}`}
                title={teacher.title}
                text={teacher.description}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Heading level="h2">Centers</Heading>
        <ul className="flex flex-row gap-10 scroll-m-10 w-full overflow-x-auto">
          {centers.map((center) => (
            <li className="w-[450px]" key={center.id}>
              <Item
                layout="grid"
                level="h3"
                href={`/centers/${center.slug}`}
                title={center.name}
                text={""}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
