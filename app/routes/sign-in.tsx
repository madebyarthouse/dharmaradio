import type { MetaFunction } from "react-router";
import { useNavigate, useSearchParams } from "react-router";
import { useEffect } from "react";
import { useLibrary } from "~/contexts/library-context";
import { noindex, shellHeaders } from "~/lib/shell-route";
import { AuthPanel } from "~/components/auth-panel";
import { BrandMark } from "~/components/brand";

export const meta: MetaFunction = () => [{ title: "Sign in — Dharma Radio" }, noindex];
export const headers = shellHeaders;

export default function SignIn() {
  const library = useLibrary();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  // Already signed in (or just finished): leave this page.
  useEffect(() => {
    if (library.user) navigate(next, { replace: true });
  }, [library.user, navigate, next]);

  return (
    <div className="mx-auto flex min-h-[75dvh] max-w-sm flex-col justify-center py-12 animate-rise">
      <BrandMark size={44} />
      <h1 className="mt-6 font-serif text-4xl tracking-tight">Welcome</h1>
      <p className="mb-8 mt-2 text-ink-soft">
        Sign in or create an account to save talks and sync your listening.
      </p>
      <AuthPanel onDone={() => navigate(next, { replace: true })} />
    </div>
  );
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/library";
}
