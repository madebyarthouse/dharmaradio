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
    <div className="">
      <Heading level="h1">Teachers</Heading>
      <hr className="mt-5" />
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 py-10">
        {latestTeachers.map((teacher) => (
          <li key={teacher.id}>
            <Link
              href={`/teachers/${teacher.slug}`}
              className={"w-full flex gap-4 flex-col group"}
            >
              <article className="flex flex-col gap-5">
                <div className="flex flex-row md:flex-col lg:flex-row gap-3 items-center">
                  {teacher.profileImageUrl && (
                    <div className="w-fit aspect-square overflow-clip ">
                      <img
                        src={teacher.profileImageUrl}
                        alt={teacher.name}
                        className="group-hover:scale-110 transition-transform"
                      />
                    </div>
                  )}
                  <Heading level="h2">{teacher.name}</Heading>
                </div>
                <div className="flex prose flex-col">
                  <p className="">
                    {teacher.description.length > 100
                      ? `${teacher.description.slice(0, 200)}...`
                      : teacher.description}
                    <br />
                    <span className="group-hover:underline underline-offset-2">
                      Read More
                    </span>
                  </p>
                </div>
              </article>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
