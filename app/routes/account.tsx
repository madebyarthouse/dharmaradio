import type { MetaFunction } from "react-router";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { Download, LogOut, Monitor, Moon, Share, SquarePlus, Sun } from "lucide-react";
import { useLibrary } from "~/contexts/library-context";
import { useInstallPrompt } from "~/hooks/use-install-prompt";
import { noindex, shellHeaders } from "~/lib/shell-route";
import { formatCount } from "~/lib/format";
import { RequireAccount } from "~/components/library-ui";
import { Avatar, Button, PageHeader } from "~/components/ui/primitives";
import { cn } from "~/lib/cn";

export const meta: MetaFunction = () => [{ title: "Account, Dharma Radio" }, noindex];
export const headers = shellHeaders;

export default function Account() {
  return (
    <div className="animate-rise">
      <PageHeader title="Account" />
      <div className="grid max-w-2xl gap-4">
        <RequireAccount title="Sign in to sync" description="Your account keeps saved talks, playlists and listening progress in step across devices.">
          <Profile />
        </RequireAccount>
        <Appearance />
        <InstallCard />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-paper-raised ring-1 ring-inset ring-line p-5 md:p-6">
      <h2 className="mb-4 font-serif text-[1.25rem] tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  );
}

function Profile() {
  const library = useLibrary();
  const navigate = useNavigate();
  const user = library.user!;

  return (
    <Card title="Profile">
      <div className="flex items-center gap-4">
        <Avatar src={user.image} name={user.name || user.email} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[1.25rem]">{user.name || "Listener"}</p>
          <p className="truncate text-sm text-ink-faint">{user.email}</p>
        </div>
      </div>
      <p className="mt-5 text-sm text-ink-soft">
        {formatCount(library.savedIds.size, "saved talk")}, {formatCount(library.likedIds.size, "liked talk")} and{" "}
        {formatCount(library.playlists.length, "playlist")}.
      </p>
      <Button
        variant="secondary"
        className="mt-5"
        onClick={async () => {
          await library.signOut();
          navigate("/");
        }}
      >
        <LogOut size={16} /> Sign out
      </Button>
    </Card>
  );
}

type Theme = "system" | "light" | "dark";
const THEME_KEY = "dharmaradio:theme";

function Appearance() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") {
      localStorage.removeItem(THEME_KEY);
      delete root.dataset.theme;
    } else {
      localStorage.setItem(THEME_KEY, next);
      root.dataset.theme = next;
    }
  };

  const options = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Day", icon: Sun },
    { value: "dark", label: "Night", icon: Moon },
  ] as const;

  return (
    <Card title="Appearance">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => choose(value)}
            className={cn(
              "flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-sm transition-colors",
              theme === value
                ? "border-accent bg-accent-wash text-ink"
                : "border-line text-ink-soft hover:bg-paper-sunken",
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function InstallCard() {
  const { canInstall, promptInstall, isIos, isStandalone } = useInstallPrompt();

  if (isStandalone) {
    return (
      <Card title="App">
        <p className="text-sm text-ink-soft">You’re using the installed app. Talks keep playing with your screen locked.</p>
      </Card>
    );
  }

  return (
    <Card title="Install the app">
      <p className="text-sm text-ink-soft">
        Add Dharma Radio to your home screen for a full-screen player, lock-screen controls and faster start-up.
      </p>
      {canInstall ? (
        <Button className="mt-4" onClick={() => void promptInstall()}>
          <Download size={16} /> Install Dharma Radio
        </Button>
      ) : isIos ? (
        <ol className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            1. Tap <Share size={16} className="text-accent-ink" /> Share in Safari
          </li>
          <li className="flex items-center gap-2">
            2. Choose <SquarePlus size={16} className="text-accent-ink" /> Add to Home Screen
          </li>
        </ol>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">Use your browser’s “Install app” option in the address bar or menu.</p>
      )}
    </Card>
  );
}
