import { prisma } from "~/lib/prisma.server";
import { notFound } from "next/navigation";
import Heading from "~/app/ui/heading";
import Link from "next/link";
import Item from "~/app/ui/item";
import { Suspense } from "react";

export default async function TalkPage({
  params,
}: {
  params: { slug: string };
}) {
  const talk = await prisma.talk.findUnique({
    where: {
      slug: params.slug,
    },
    include: {
      teacher: true,
    },
  });

  if (!talk) {
    notFound();
  }

  const talksByTeacher = await prisma.talk.findMany({
    where: {
      teacherId: talk.teacherId,
      retreatId: {
        not: talk.retreatId,
      },
    },
    take: 5,
  });

  const talksFromRetreat = await prisma.talk.findMany({
    where: {
      retreatId: talk.retreatId,
    },
    take: 5,
  });

  return (
    <div className="flex flex-col md:flex-row gap-10">
      <section className="flex flex-col gap-10 w-full md:w-2/3 order-1 md:order-2">
        <div>
          <Heading level="h1">{talk.title}</Heading>
          <p className="my-5">{talk.description}</p>
          {talk.audioUrl && <audio controls src={talk.audioUrl} />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <section aria-label="Other talks by this teacher">
            <Heading level="h3">Other talks by this teacher</Heading>
            <hr className="mt-2" />
            <ul className="flex flex-col gap-5 w-full py-5">
              <Suspense fallback={<div>Loading...</div>}>
                {talksByTeacher.map((talk) => (
                  <li key={talk.id}>
                    <Item
                      level="h4"
                      layout="list"
                      href={`/talks/${talk.slug}`}
                      title={talk.title}
                      text={""}
                    />
                  </li>
                ))}
              </Suspense>
            </ul>
          </section>

          <section aria-label="Other talks by this teacher">
            <Heading level="h3">Other talks from this retreat</Heading>
            <hr className="mt-2" />
            <ul className="flex flex-col gap-5 w-full py-5">
              <Suspense fallback={<div>Loading...</div>}>
                {talksFromRetreat.map((talk) => (
                  <li key={talk.id}>
                    <Item
                      level="h4"
                      layout="list"
                      href={`/talks/${talk.slug}`}
                      title={talk.title}
                      text={""}
                    />
                  </li>
                ))}
              </Suspense>
            </ul>
          </section>
        </div>
      </section>
      <aside className="w-full md:w-1/3 order-2 md:order-1">
        <Link
          href={`/teachers/${talk.teacher.slug}`}
          className={"w-full flex gap-4 flex-col group"}
        >
          <article className="flex flex-col gap-5">
            <div className="flex flex-row md:flex-col lg:flex-row gap-3 items-center">
              {talk.teacher.profileImageUrl && (
                <div className="w-fit overflow-clip ">
                  <img
                    src={talk.teacher.profileImageUrl}
                    alt={talk.teacher.name}
                    className="group-hover:scale-110 transition-transform"
                  />
                </div>
              )}
              <Heading level="h2">{talk.teacher.name}</Heading>
            </div>
            <div className="flex prose flex-col">
              <p className="prose prose-lg">
                {talk.teacher.description.length > 100
                  ? `${talk.teacher.description.slice(0, 200)}...`
                  : talk.teacher.description}
                <br />
                <span className="group-hover:underline underline-offset-2">
                  Read More
                </span>
              </p>
            </div>
          </article>
        </Link>
      </aside>
    </div>
  );
}
