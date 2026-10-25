import { Link } from "react-router";
import { WifiOff } from "lucide-react";
import { buttonClass } from "~/components/ui/primitives";

export function meta() {
  return [{ title: "Offline, Dharma Radio" }, { name: "robots", content: "noindex" }];
}

export default function Offline() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center animate-rise">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
        <WifiOff size={24} />
      </span>
      <h1 className="mt-6 font-serif text-[2.375rem] leading-tight tracking-[-0.02em]">You’re offline</h1>
      <p className="mt-3 max-w-sm text-pretty text-ink-soft">
        A pause in the signal. Pages you’ve visited may still open; talks will stream again once
        you’re back online.
      </p>
      <Link to="/" reloadDocument className={buttonClass("primary") + " mt-8"}>
        Try again
      </Link>
    </div>
  );
}
