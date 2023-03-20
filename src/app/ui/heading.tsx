export default function Heading({
  level,
  children,
}: {
  level: "h1" | "h2" | "h3" | "h4";
  children: React.ReactNode;
}) {
  const HeadingEl = level;
  const headingClasses = {
    h1: "text-5xl text-brand font-semibold font-heading",
    h2: "text-4xl text-brand font-medium font-heading",
    h3: "text-3xl text-brand font-medium font-heading",
    h4: "text-2xl text-brand font-medium font-heading",
  };

  return <HeadingEl className={headingClasses[level]}>{children}</HeadingEl>;
}
