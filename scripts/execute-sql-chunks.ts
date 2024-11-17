import { readFileSync } from "fs";
import { exec } from "child_process";

type Options = {
  filePath: string;
  chunkSize?: number;
  dryRun?: boolean;
};

async function executeWranglerCommand(sql: string) {
  const command = `npx wrangler d1 execute dharmaradio-db --remote --command "${sql.replace(
    /"/g,
    '\\"'
  )}"`;

  try {
    const { stdout, stderr } = await new Promise<{
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      });
    });

    if (stderr) {
      console.error("stderr:", stderr);
    }
    console.log("stdout:", stdout);
  } catch (error) {
    console.error("Error executing command:", error);
    throw error;
  }
}

function parseValuesTuples(sql: string): string[] {
  // Find where VALUES starts
  const valuesIndex = sql.indexOf("VALUES");
  if (valuesIndex === -1) return [];

  // Get everything after VALUES
  const valuesStr = sql.slice(valuesIndex + 6).trim();

  const tuples: string[] = [];
  let currentTuple = "";
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (escapeNext) {
      currentTuple += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      currentTuple += char;
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inString) {
      inString = true;
      currentTuple += char;
    } else if (char === "'" && inString) {
      inString = false;
      currentTuple += char;
    } else if (char === "(" && !inString) {
      depth++;
      currentTuple += char;
    } else if (char === ")" && !inString) {
      depth--;
      currentTuple += char;
      if (depth === 0) {
        tuples.push(currentTuple.trim());
        currentTuple = "";
      }
    } else if (depth > 0 || inString) {
      currentTuple += char;
    }
  }

  return tuples;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function splitIntoStatements(sql: string): string[] {
  // Split on "INSERT INTO" but keep the delimiter
  const parts = sql.split(/(?=INSERT INTO)/i);

  // Filter out empty statements and trim whitespace
  return parts.map((stmt) => stmt.trim()).filter((stmt) => stmt.length > 0);
}

async function executeSqlChunks({
  filePath,
  chunkSize = 50,
  dryRun = false,
}: Options) {
  // Read the SQL file
  const sqlContent = readFileSync(filePath, "utf-8");

  // Split into separate INSERT statements
  const statements = splitIntoStatements(sqlContent);
  console.log(`Found ${statements.length} SQL statements`);

  for (const sql of statements) {
    if (!sql.toLowerCase().startsWith("insert into")) {
      if (!dryRun) {
        await executeWranglerCommand(sql);
      } else {
        console.log("Would execute:", sql);
      }
      continue;
    }

    // Get the INSERT INTO prefix
    const insertPrefix = sql.match(/^INSERT INTO .+ VALUES/i)?.[0];
    if (!insertPrefix) {
      console.error("Failed to parse INSERT prefix");
      continue;
    }

    // Parse value tuples
    const valuesTuples = parseValuesTuples(sql);
    console.log(`Found ${valuesTuples.length} value tuples`);

    // Split into chunks
    const chunks = chunkArray(valuesTuples, chunkSize);

    // Execute each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkStatement = `${insertPrefix} ${chunk.join(",")}`;

      console.log(
        `Executing chunk ${i + 1}/${chunks.length} (${chunk.length} rows)`
      );

      if (!dryRun) {
        await executeWranglerCommand(chunkStatement);
      } else {
        console.log("Would execute chunk:", chunkStatement);
      }
    }
  }
}

// Check if this is the main module
(async () => {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const chunkSize = parseInt(args[1] || "50", 10);
  const dryRun = args.includes("--dry-run");

  if (!filePath) {
    console.error("Please provide a SQL file path");
    process.exit(1);
  }

  executeSqlChunks({ filePath, chunkSize, dryRun })
    .then(() => console.log("Done!"))
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
})();

export { executeSqlChunks };
