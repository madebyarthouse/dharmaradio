import { useRef, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { useLibrary } from "~/contexts/library-context";
import { Button } from "~/components/ui/primitives";

type Step = { kind: "start" } | { kind: "code"; email: string };

/** One-time email code. A code rather than a magic link, so sign-in completes inside an installed PWA. */
export function AuthPanel({ onDone }: { onDone?: () => void }) {
  const library = useLibrary();
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [pending, setPending] = useState<null | "email" | "code">(null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);


  const sendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setError(null);
    setPending("email");
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(null);
    if (error) {
      setError(error.message ?? "We couldn’t send the code. Please try again.");
      return;
    }
    setStep({ kind: "code", email });
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.kind !== "code") return;
    const otp = String(new FormData(event.currentTarget).get("otp") ?? "").replace(/\s/g, "");
    if (otp.length < 6) return;
    setError(null);
    setPending("code");
    const { error } = await authClient.signIn.emailOtp({ email: step.email, otp });
    if (error) {
      setPending(null);
      setError(error.message ?? "That code didn’t match. Check it and try again.");
      return;
    }
    await library.refresh();
    setPending(null);
    onDone?.();
  };

  if (step.kind === "code") {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setStep({ kind: "start" });
            setError(null);
          }}
          className="-ml-2 mb-4 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="font-serif text-2xl tracking-tight">Check your inbox</h2>
        <p className="mt-2 text-sm text-ink-soft">
          We sent a 6-digit code to <span className="text-ink">{step.email}</span>.
        </p>
        <form onSubmit={verify} className="mt-6 space-y-3">
          <input
            ref={codeRef}
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            placeholder="000000"
            aria-label="6-digit code"
            className="h-14 w-full rounded-2xl border border-line-strong bg-paper-raised text-center font-serif text-3xl tracking-[0.4em] tabular-nums outline-none placeholder:text-ink-faint/40 focus:shadow-[0_0_0_4px_var(--accent-wash)]"
            onChange={(e) => {
              if (e.currentTarget.value.replace(/\s/g, "").length === 6) e.currentTarget.form?.requestSubmit();
            }}
          />
          <Button type="submit" className="w-full" disabled={pending === "code"}>
            {pending === "code" ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={sendCode} className="space-y-2.5">
        <label className="relative block">
          <span className="sr-only">Email</span>
          <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12 w-full rounded-full border border-line-strong bg-paper-raised pl-11 pr-4 outline-none placeholder:text-ink-faint focus:shadow-[0_0_0_4px_var(--accent-wash)]"
          />
        </label>
        <Button type="submit" className="h-12 w-full" disabled={pending !== null}>
          {pending === "email" ? "Sending code…" : "Email me a sign-in code"}
        </Button>
      </form>
      {error ? <ErrorText>{error}</ErrorText> : null}

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
        Your account only stores what you save, like and listen to. No newsletters.
      </p>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-center text-sm text-[oklch(0.55_0.17_28)]">
      {children}
    </p>
  );
}
