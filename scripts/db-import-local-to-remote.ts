import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DATABASE_NAME = "dharmaradio";
const DUMP_FILE = "db-dump.sql";

function getWranglerCli() {
  return "pnpm exec wrangler";
}

function run(command: string) {
  execSync(command, { stdio: "inherit" });
}

async function confirmOrExit(force: boolean) {
  if (force) return;

  const rl = createInterface({ input, output });
  const question = [
    chalk.yellow("This will overwrite the ") +
      chalk.cyan("REMOTE") +
      chalk.yellow(" D1 database ") +
      chalk.bold.cyan(DATABASE_NAME),
    chalk.yellow("with the current contents of your ") +
      chalk.cyan("LOCAL") +
      chalk.yellow(" database."),
    "",
    chalk.red.bold("Danger: ") +
      chalk.yellow("Production/remote data may be lost."),
    "",
    chalk.white("Continue? ") + chalk.gray("[y/N] "),
  ].join("\n");

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
      `${getWranglerCli()} d1 export ${DATABASE_NAME} --local --output=./${DUMP_FILE}`,
    );
    spinner.succeed("Local export completed");
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

main().catch((error) => {
  console.error(chalk.red("Operation failed."));
  console.error(error);
  process.exit(1);
});
