import { redirect } from "@remix-run/cloudflare";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/centers/${params.slug}/talks`);
}
