import chalk from "chalk";
import ora from "ora";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { syncTalks } from "../app/sync/sync-to-db";
import { syncTeachers } from "../app/sync/sync-teachers";

type Flags = {
  dryRun: boolean;
  maxPages: number | undefined;
  talks: boolean;
  teachers: boolean;
};

function parseFlags(): Flags {
  const args = process.argv.slice(2);
  const maxPagesArg =
    args.find((arg) => arg.startsWith("--max-pages=")) ??
    args.find((arg) => arg.startsWith("--limit="));
  const maxPages = maxPagesArg
    ? Number.parseInt(maxPagesArg.split("=")[1] ?? "", 10)
    : undefined;
  const teachers = args.includes("--teachers");
  const talks = args.includes("--talks");

  return {
    dryRun: args.includes("--dry-run"),
    maxPages: Number.isFinite(maxPages) ? maxPages : undefined,
    talks: talks || (!talks && !teachers),
    teachers: teachers || (!talks && !teachers),
  };
}

function logResultTable(
  title: string,
  result: {
    failedCount: number;
    meta: Record<string, unknown>;
    processedCount: number;
    status: string;
  },
) {
  const fetchStats =
    result.meta.fetchStats && typeof result.meta.fetchStats === "object"
      ? (result.meta.fetchStats as { pagesFetched?: number })
      : null;

  console.log(chalk.magenta(title));
  console.table([
    { metric: "status", value: result.status },
    { metric: "processedCount", value: result.processedCount },
    { metric: "failedCount", value: result.failedCount },
    {
      metric: "pagesFetched",
      value: String(fetchStats?.pagesFetched ?? result.meta.pagesFetched ?? "n/a"),
    },
    { metric: "mode", value: String(result.meta.mode ?? "full") },
    { metric: "maxPages", value: String(result.meta.maxPages ?? "all") },
  ]);
}

function logRunConfiguration(flags: Flags) {
  console.log(chalk.cyan("Local sync configuration"));
  console.table([
    { option: "teachers", value: flags.teachers ? "yes" : "no" },
    { option: "talks", value: flags.talks ? "yes" : "no" },
    { option: "maxPages", value: String(flags.maxPages ?? "all") },
    { option: "d1StatePath", value: ".wrangler/state/v3" },
  ]);
}

function runWrangler(commandArgs: string[]) {
  return execFileSync("pnpm", ["exec", "wrangler", ...commandArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function applyLocalMigrations(persistPath: string) {
  const spinner = ora(chalk.cyan("applying local D1 migrations")).start();
  try {
    runWrangler([
      "d1",
      "migrations",
      "apply",
      "dharmaradio",
      "--local",
      "--persist-to",
      persistPath,
    ]);
    spinner.succeed(chalk.green("local D1 migrations applied"));
  } catch (error) {
    spinner.fail(chalk.red("failed to apply local D1 migrations"));
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }
}

async function main() {
  process.env.LOG_LEVEL = "warn";
  process.env.DB_QUERY_LOG = "0";

  const flags = parseFlags();
  const startedAt = Date.now();
  const wranglerPersistRoot = ".wrangler/state";
  const proxyPersistRoot = join(wranglerPersistRoot, "v3");

  if (flags.dryRun) {
    throw new Error(
      "--dry-run is not supported for the shared local D1 workflow. Import production to local first, then run with --max-pages for a bounded sync against the same local state the app uses.",
    );
  }

  console.log(chalk.bold.cyan("Dharma Radio local sync"));
  logRunConfiguration(flags);
  applyLocalMigrations(wranglerPersistRoot);

  const proxySpinner = ora(
    chalk.cyan("initializing local Cloudflare bindings"),
  ).start();
  const platform = await getPlatformProxy<Env>({
    configPath: "./wrangler.jsonc",
    persist: { path: proxyPersistRoot },
    remoteBindings: false,
  });
  proxySpinner.succeed(chalk.green("local Cloudflare bindings ready"));

  try {
    const summary: {
      dryRun: boolean;
      maxPages: number | null;
      talks: Awaited<ReturnType<typeof syncTalks>> | null;
      teachers: Awaited<ReturnType<typeof syncTeachers>> | null;
    } = {
      dryRun: flags.dryRun,
      maxPages: flags.maxPages ?? null,
      talks: null,
      teachers: null,
    };

    if (flags.teachers) {
      const spinner = ora(chalk.cyan("syncing teachers into local D1")).start();
      try {
        summary.teachers = await syncTeachers(platform.env.DB, {
          maxPages: flags.maxPages,
        });
        spinner.succeed(chalk.green("teacher sync completed"));
        logResultTable("Teacher sync summary", summary.teachers);
      } catch (error) {
        spinner.fail(chalk.red("teacher sync failed"));
        throw error;
      }
    }

    if (flags.talks) {
      const spinner = ora(chalk.cyan("syncing talks into local D1")).start();
      try {
        summary.talks = await syncTalks(platform.env.DB, {
          maxPages: flags.maxPages,
          mode: "full",
          skipProcessing: false,
        });
        spinner.succeed(chalk.green("talk sync completed"));
        logResultTable("Talk sync summary", summary.talks);
      } catch (error) {
        spinner.fail(chalk.red("talk sync failed"));
        throw error;
      }
    }

    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      chalk.green(`Local sync finished in ${durationSeconds}s using shared local D1 state.`),
    );
  } finally {
    await platform.dispose();
  }
}

main().catch((error) => {
  console.error(chalk.red("Local sync failed."));
  console.error(error);
  process.exit(1);
});
