export default function Heading({
  level,
  children,
}: {
  level: "h1" | "h2" | "h3" | "h4";
  children: React.ReactNode;
}) {
  const HeadingEl = level;
  const headingClasses = {
    h1: "text-5xl font-bold font-heading",
    h2: "text-4xl font-bold font-heading",
    h3: "text-3xl font-bold font-heading",
    h4: "text-2xl font-bold font-heading",
  };

  return <HeadingEl className={headingClasses[level]}>{children}</HeadingEl>;
}
