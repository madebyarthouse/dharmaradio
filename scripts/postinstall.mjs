import { execSync } from "node:child_process";

const isPagesBuild =
  process.env.CF_PAGES === "1" ||
  process.env.CF_PAGES === "true" ||
  process.env.CLOUDFLARE_PAGES === "1" ||
  process.env.CLOUDFLARE_PAGES === "true";

if (isPagesBuild) {
  console.log(
    "[postinstall] Skipping `wrangler types` because this environment is a Cloudflare Pages build.",
  );
  process.exit(0);
}

if (process.env.SKIP_CF_TYPEGEN === "1") {
  console.log("[postinstall] Skipping `wrangler types` because SKIP_CF_TYPEGEN=1.");
  process.exit(0);
}

execSync("pnpm run cf-typegen", {
  stdio: "inherit",
});
