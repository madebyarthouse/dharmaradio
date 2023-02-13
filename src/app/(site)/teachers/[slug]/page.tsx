import { prisma } from "~/lib/prisma.server";
import { notFound } from "next/navigation";
import Heading from "~/app/ui/heading";
import Link from "next/link";
import Item from "~/app/ui/item";

export default async function TeacherPage({
  params,
}: {
  params: { slug: string };
}) {
  const teacher = await prisma.teacher.findUnique({
    where: {
      slug: params.slug,
    },
    include: {
      talks: {
        take: 10,
        orderBy: {
          publicationDate: "desc",
        },
      },
    },
  });

  if (!teacher) {
    notFound();
  }

  return (
    <article className="flex flex-col md:flex-row gap-10">
      <div className="w-full md:w-1/3 prose prose-h1:my-0">
        <div className="sticky top-0">
          {teacher.profileImageUrl && (
            <img src={teacher.profileImageUrl} alt={teacher.name} />
          )}
          <Heading level="h1">{teacher.name}</Heading>
          <p>{teacher.description}</p>
        </div>
      </div>

      <div className="w-full md:w-2/3">
        <div className="sticky top-0 py-3 border-b border-text bg-white">
          <Heading level="h2">Talks</Heading>
        </div>
        <ul className="flex flex-col gap-5 w-full py-5">
          {teacher.talks.map((talk) => (
            <li key={talk.id}>
              <Item
                level="h3"
                layout="list"
                href={`/talks/${talk.slug}`}
                title={talk.title}
                text={talk.description}
              />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
