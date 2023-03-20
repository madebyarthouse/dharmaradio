import Link from "next/link";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="landing-bg min-h-screen w-full">{children}</div>;
}
