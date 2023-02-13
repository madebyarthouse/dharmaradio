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
    <header className="flex flex-row py-5">
      <Link href="/">Dharma Radio</Link>
      <nav>
        <ul className="flex flex-row gap-2">
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
