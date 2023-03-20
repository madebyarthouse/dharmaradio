import Link from "next/link";

const links = [
  {
    href: "/talks",
    label: "Talks",
  },
  {
    href: "/teachers",
    label: "Teachers",
  },
  {
    href: "/retreats",
    label: "Retreats",
  },
  {
    href: "centers",
    label: "Centers",
  },
  {
    href: "/about",
    label: "About",
  },
  {
    href: "/donate",
    label: "Donate",
  },
];

export default function SiteHeader({}) {
  return (
    <header className="flex flex-col gap-5 text-center md:text-left md:flex-row items-center py-8 px-5">
      <Link href="/" className="text-4xl font-bold">
        Dharma&nbsp;Radio
      </Link>
      <nav>
        <ul className="flex flex-row gap-2 flex-wrap justify-center md:justify-start text-lg">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link className="py-1 px-2 underline-offset-2" href={href}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
