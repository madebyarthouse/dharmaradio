import { pathToFileURL } from "node:url";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DATABASE_NAME = "dharmaradio";
const DUMP_FILE = "db-dump.sql";

// Explicit allowlist: user/session/account/verification, library tables and
// d1_migrations are never exported. Keep each database's migration ledger local.
const CATALOGUE_TABLES = [
  "teachers",
  "centers",
  "retreats",
  "talks",
  "sync_runs",
];
const TABLE_FLAGS = CATALOGUE_TABLES.map((table) => `--table=${table}`).join(
  " ",
);

/** Convert data-only exports to upserts: REPLACE or deleting talks would cascade
 * into the destination library. Parse SQL strings so semicolons/newlines in talk
 * descriptions cannot split statements or inject a second command. */
export function catalogueUpserts(dump: string): string {
  const statements: string[] = [];
  let start = 0;
  let quote = "";
  for (let i = 0; i < dump.length; i++) {
    const char = dump[i];
    if (quote) {
      if (char === quote) {
        if (dump[i + 1] === quote) i++;
        else quote = "";
      }
    } else if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === ";") {
      statements.push(dump.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (quote || dump.slice(start).trim())
    throw new Error("Incomplete SQL export");
  const upserts = statements.filter(Boolean).map((statement) => {
    if (/^PRAGMA defer_foreign_keys\s*=\s*TRUE$/i.test(statement))
      return statement + ";";
    const match = /^INSERT INTO "(\w+)" \(([^)]+)\) VALUES\(/.exec(statement);
    if (!match || !CATALOGUE_TABLES.includes(match[1]))
      throw new Error("Export contains an unexpected table or statement");
    const columns = match[2].split(",").map((c) => c.trim());
    if (!columns.includes('"id"') || columns.some((c) => !/^"\w+"$/.test(c)))
      throw new Error("Unexpected export columns");
    const updates = columns
      .filter((c) => c !== '"id"')
      .map((c) => `${c}=excluded.${c}`)
      .join(",");
    return `${statement} ON CONFLICT("id") DO UPDATE SET ${updates};`;
  });
  return upserts.join("\n");
}

function prepareCatalogueDump() {
  writeFileSync(DUMP_FILE, catalogueUpserts(readFileSync(DUMP_FILE, "utf8")));
}

function getWranglerCli() {
  return "pnpm exec wrangler";
}

function run(command: string) {
  execSync(command, { stdio: "inherit" });
}

async function confirmOrExit(force: boolean) {
  if (force) return;

  const rl = createInterface({ input, output });
  const question = chalk.yellow(
    "Upsert local catalogue rows into REMOTE D1? Existing catalogue rows may change. Accounts, library data and migration history are preserved. [y/N] ",
  );

  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();

  if (answer !== "y" && answer !== "yes") {
    console.log(chalk.red("Aborted."));
    process.exit(1);
  }
}

function exportLocalToDump() {
  const spinner = ora("Exporting local database to dump").start();
  try {
    run(
      `${getWranglerCli()} d1 export ${DATABASE_NAME} --local --no-schema ${TABLE_FLAGS} --output=./${DUMP_FILE}`,
    );
    prepareCatalogueDump();
    spinner.succeed(
      "Catalogue export completed (accounts and migration history excluded)",
    );
  } catch (error) {
    spinner.fail("Failed exporting local database");
    throw error;
  }
}

function importDumpToRemote() {
  const spinner = ora("Importing dump into remote database").start();
  try {
    run(
      `${getWranglerCli()} d1 execute ${DATABASE_NAME} --remote --file=./${DUMP_FILE}`,
    );
    spinner.succeed("Remote import completed");
  } catch (error) {
    spinner.fail("Failed importing into remote database");
    throw error;
  }
}

function cleanupDump() {
  const spinner = ora("Cleaning up dump file").start();
  try {
    if (existsSync(DUMP_FILE)) {
      unlinkSync(DUMP_FILE);
    }
    spinner.succeed("Cleanup complete");
  } catch (error) {
    spinner.fail("Failed cleaning up dump file");
    throw error;
  }
}

async function main() {
  const force = process.argv.includes("--yes") || process.argv.includes("-y");
  await confirmOrExit(force);
  exportLocalToDump();
  importDumpToRemote();
  console.log(chalk.green("\nData import to remote completed successfully."));
  cleanupDump();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(chalk.red("Operation failed."));
    console.error(error);
    process.exit(1);
  });
