import clsx from "clsx";
import Link from "next/link";
import Heading from "./heading";

export default function Item({
  layout,
  title,
  level = "h2",
  mediaUrl,
  text,
  href,
}: {
  layout: "list" | "grid";
  level?: "h2" | "h3" | "h4";
  title: string;
  mediaUrl?: string | null;
  text: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "w-full flex gap-4",
        layout === "list" && "flex-row",
        layout === "grid" && "flex-col"
      )}
    >
      <article>
        {mediaUrl && (
          <div className="w-full overflow-clip group">
            <img
              src={mediaUrl}
              alt={title}
              className="group-hover:scale-110 transition-transform"
            />
          </div>
        )}
        <div className="flex prose flex-col">
          <Heading level={level}>{title}</Heading>
          <p>{text}</p>
        </div>
      </article>
    </Link>
  );
}
