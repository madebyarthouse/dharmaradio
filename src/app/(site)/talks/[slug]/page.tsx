import { prisma } from "~/lib/prisma.server";
import { notFound } from "next/navigation";
import Heading from "~/app/ui/heading";
import Link from "next/link";

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

  return (
    <div>
      <Heading level="h1">{talk.title}</Heading>
      <Link
        className="flex items-center flex-col"
        href={`/teachers/${talk.teacher.slug}`}
      >
        {talk.teacher.profileImageUrl && (
          <img src={talk.teacher.profileImageUrl} alt={talk.teacher.name} />
        )}
        <span>{talk.teacher.name}</span>
      </Link>
      <p>{talk.description}</p>
      {talk.audioUrl && <audio controls src={talk.audioUrl} />}
    </div>
  );
}
