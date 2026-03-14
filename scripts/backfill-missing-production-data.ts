import { execFileSync } from "node:child_process";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import { fetchTeacherFromDharmaseed } from "../app/sync/lib/fetch-teacher";
import { parseTalksFromHtml } from "../app/sync/lib/parse-html";
import { withRetry } from "../app/sync/lib/retry";
import type { ScrapedTalk } from "../app/sync/lib/types";
import { dharmaSeedBase, slugify, sumTime, urlForPage } from "../app/sync/lib/utils";

const DATABASE_NAME = "dharmaradio";
const DEFAULT_SCAN_PAGE_LIMIT = 500;
const MUTATION_CHUNK_SIZE = 50;
const PROGRESS_INTERVAL = 25;
const PAGE_FETCH_CONCURRENCY = 8;
const RETREAT_DISCOVERY_CANDIDATE_MULTIPLIER = 25;
const TEACHER_FETCH_CONCURRENCY = 4;

type Flags = {
  dryRun: boolean;
  limit: number | null;
  talks: boolean;
  teachers: boolean;
};

type QueryRow = Record<string, string | number | null>;
type LookupState = {
  centerSubdomains: Set<string>;
  retreatIds: Set<number>;
  teacherIds: Set<number>;
};
type CoreTalkTargetRow = {
  dharmaSeedId: number;
  missingAudioUrl: number;
  missingCenterId: number;
  missingDescription: number;
  missingPublicationDate: number;
  slug: string;
};
type RetreatCandidateRow = {
  dharmaSeedId: number;
};
type TalkScanResult = {
  matched: Map<number, ScrapedTalk>;
  missing: number[];
  pagesScanned: number;
};

function formatData(data: Record<string, unknown>) {
  return chalk.dim(JSON.stringify(data, null, 2));
}

function logStep(message: string, data?: Record<string, unknown>) {
  const prefix = chalk.cyan(
    `[backfill ${new Date().toISOString()}] ${message}`,
  );
  if (!data) {
    console.log(prefix);
    return;
  }
  console.log(prefix);
  console.log(formatData(data));
}

function logSample(label: string, items: unknown[]) {
  if (items.length === 0) return;
  console.log(chalk.yellow(label));
  console.log(formatData({ items }));
}

function logMetricsTable(title: string, metrics: Record<string, number | string | null>) {
  console.log(chalk.magenta(title));
  console.table(
    Object.entries(metrics).map(([metric, value]) => ({
      metric,
      value,
    })),
  );
}

function withSpinner<T>(label: string, fn: () => T) {
  const spinner = ora(chalk.cyan(label)).start();
  try {
    const startedAt = Date.now();
    const result = fn();
    spinner.succeed(
      chalk.green(`${label} (${Date.now() - startedAt}ms)`),
    );
    return result;
  } catch (error) {
    spinner.fail(chalk.red(label));
    throw error;
  }
}

async function withSpinnerAsync<T>(
  label: string,
  fn: (spinner: Ora) => Promise<T>,
) {
  const spinner = ora(chalk.cyan(label)).start();
  try {
    const startedAt = Date.now();
    const result = await fn(spinner);
    spinner.succeed(
      chalk.green(`${label} (${Date.now() - startedAt}ms)`),
    );
    return result;
  } catch (error) {
    spinner.fail(chalk.red(label));
    throw error;
  }
}

async function mapConcurrent<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = currentIndex;
      currentIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index] as T, index);
    }
  });

  await Promise.all(workers);
  return results;
}

function parseFlags(): Flags {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : null;
  const teachers = args.includes("--teachers");
  const talks = args.includes("--talks");

  return {
    dryRun: args.includes("--dry-run"),
    limit: Number.isFinite(limit) ? limit : null,
    talks: talks || (!talks && !teachers),
    teachers: teachers || (!talks && !teachers),
  };
}

function getWranglerCliArgs() {
  return ["exec", "wrangler", "d1", "execute", DATABASE_NAME, "--local"];
}

function execLocalSql<T extends QueryRow>(sql: string) {
  return withSpinner("running local D1 query", () => {
    const output = execFileSync(
      "pnpm",
      [...getWranglerCliArgs(), "--command", sql, "--json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const parsed = JSON.parse(output) as Array<{ results?: T[] }>;
    return parsed[0]?.results ?? [];
  });
}

function runLocalMutation(sql: string, label: string) {
  withSpinner(label, () => {
    execFileSync("pnpm", [...getWranglerCliArgs(), "--command", sql], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
  });
}

function runLocalMutations(statements: string[], label: string) {
  if (statements.length === 0) return;

  for (let start = 0; start < statements.length; start += MUTATION_CHUNK_SIZE) {
    const chunk = statements.slice(start, start + MUTATION_CHUNK_SIZE);
    const sql = ["BEGIN;", ...chunk, "COMMIT;"].join("\n");
    runLocalMutation(
      sql,
      `${label} (${start + 1}-${start + chunk.length} of ${statements.length})`,
    );
  }
}

function sqlString(value: string | null) {
  if (value === null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number | null) {
  return value === null ? "NULL" : String(value);
}

function sqlDate(value: Date | null) {
  return value === null ? "NULL" : sqlString(value.toISOString());
}

function normalizeAudioUrl(audioUrl: string | null) {
  if (!audioUrl) return null;
  return audioUrl.startsWith("http") ? audioUrl : `${dharmaSeedBase}${audioUrl}`;
}

function parsePublicationDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRetreatCandidateLimit(limit: number | null) {
  if (limit === null) return null;
  return Math.max(limit * RETREAT_DISCOVERY_CANDIDATE_MULTIPLIER, limit);
}

async function fetchTalkPage(page: number) {
  const html = await withRetry(async () => {
    const response = await fetch(urlForPage(page));
    if (!response.ok) {
      throw new Error(`Failed to fetch talk page ${page}: ${response.status}`);
    }
    return response.text();
  });

  return {
    page,
    talks: parseTalksFromHtml(await html),
  };
}

async function fetchTalkPageBatch(pages: number[]) {
  const batch = await Promise.all(pages.map((page) => fetchTalkPage(page)));
  return batch.sort((left, right) => left.page - right.page);
}

async function fetchTalksById(targetIds: number[]): Promise<TalkScanResult> {
  if (targetIds.length === 0) {
    return {
      matched: new Map<number, ScrapedTalk>(),
      missing: [],
      pagesScanned: 0,
    };
  }

  const remaining = new Set(targetIds);
  const matched = new Map<number, ScrapedTalk>();
  let nextPage = 1;
  let pagesFetched = 0;

  logStep("starting concurrent talk rescrape scan", {
    concurrency: PAGE_FETCH_CONCURRENCY,
    pageLimit: DEFAULT_SCAN_PAGE_LIMIT,
    targetIds: targetIds.length,
  });

  const result = await withSpinnerAsync("fetching talk pages", async (spinner) => {
    let reachedEnd = false;

    while (
      remaining.size > 0 &&
      nextPage <= DEFAULT_SCAN_PAGE_LIMIT &&
      !reachedEnd
    ) {
      const pages = Array.from(
        { length: Math.min(PAGE_FETCH_CONCURRENCY, DEFAULT_SCAN_PAGE_LIMIT - nextPage + 1) },
        (_, offset) => nextPage + offset,
      );
      nextPage += pages.length;

      const batch = await fetchTalkPageBatch(pages);

      for (const pageResult of batch.sort((left, right) => left.page - right.page)) {
        pagesFetched = Math.max(pagesFetched, pageResult.page);
        if (pageResult.talks.length === 0) {
          reachedEnd = true;
          continue;
        }

        for (const talk of pageResult.talks) {
          if (!remaining.has(talk.talkId)) continue;
          matched.set(talk.talkId, talk);
          remaining.delete(talk.talkId);
        }
      }

      spinner.text = chalk.cyan(
        `fetching talk pages (pages=${pagesFetched}, matched=${matched.size}, remaining=${remaining.size})`,
      );

      if (
        pagesFetched <= PAGE_FETCH_CONCURRENCY ||
        pagesFetched % PROGRESS_INTERVAL === 0 ||
        remaining.size === 0
      ) {
        logStep("talk scan progress", {
          matched: matched.size,
          pagesFetched,
          remaining: remaining.size,
          sampleMatchedTalks: [...matched.values()].slice(0, 5).map((talk) => ({
            audioUrl: talk.audioUrl,
            date: talk.date,
            retreat: talk.retreat,
            retreatId: talk.retreatId,
            talkId: talk.talkId,
            title: talk.title,
          })),
        });
      }
    }

    return {
      matched,
      missing: [...remaining],
      pagesScanned: pagesFetched,
    };
  });

  logSample(
    "Matched talk sample",
    [...result.matched.values()].slice(0, 5).map((talk) => ({
      audioUrl: talk.audioUrl,
      center: talk.center,
      centerSubdomain: talk.centerSubdomain,
      publicationDate: talk.date,
      retreat: talk.retreat,
      retreatId: talk.retreatId,
      talkId: talk.talkId,
      title: talk.title,
    })),
  );

  return result;
}

async function discoverRetreatTalks(
  candidateIds: number[],
): Promise<TalkScanResult> {
  if (candidateIds.length === 0) {
    return {
      matched: new Map<number, ScrapedTalk>(),
      missing: [],
      pagesScanned: 0,
    };
  }

  const remaining = new Set(candidateIds);
  const matched = new Map<number, ScrapedTalk>();
  let nextPage = 1;
  let pagesFetched = 0;

  logStep("starting retreat discovery scan", {
    candidateIds: candidateIds.length,
    concurrency: PAGE_FETCH_CONCURRENCY,
    pageLimit: DEFAULT_SCAN_PAGE_LIMIT,
  });

  const result = await withSpinnerAsync(
    "discovering retreat talks",
    async (spinner) => {
      let reachedEnd = false;

      while (
        remaining.size > 0 &&
        nextPage <= DEFAULT_SCAN_PAGE_LIMIT &&
        !reachedEnd
      ) {
        const pages = Array.from(
          {
            length: Math.min(
              PAGE_FETCH_CONCURRENCY,
              DEFAULT_SCAN_PAGE_LIMIT - nextPage + 1,
            ),
          },
          (_, offset) => nextPage + offset,
        );
        nextPage += pages.length;

        const batch = await fetchTalkPageBatch(pages);

        for (const pageResult of batch) {
          pagesFetched = Math.max(pagesFetched, pageResult.page);
          if (pageResult.talks.length === 0) {
            reachedEnd = true;
            continue;
          }

          for (const talk of pageResult.talks) {
            if (!talk.retreat || !talk.retreatId) continue;
            if (!remaining.has(talk.talkId)) continue;
            matched.set(talk.talkId, talk);
            remaining.delete(talk.talkId);
          }
        }

        spinner.text = chalk.cyan(
          `discovering retreat talks (pages=${pagesFetched}, matched=${matched.size}, remaining=${remaining.size})`,
        );

        if (
          pagesFetched <= PAGE_FETCH_CONCURRENCY ||
          pagesFetched % PROGRESS_INTERVAL === 0 ||
          remaining.size === 0
        ) {
          logStep("retreat discovery progress", {
            matched: matched.size,
            pagesFetched,
            remaining: remaining.size,
            sampleMatchedTalks: [...matched.values()].slice(0, 5).map((talk) => ({
              publicationDate: talk.date,
              retreat: talk.retreat,
              retreatId: talk.retreatId,
              talkId: talk.talkId,
              title: talk.title,
            })),
          });
        }
      }

      return {
        matched,
        missing: [...remaining],
        pagesScanned: pagesFetched,
      };
    },
  );

  logSample(
    "Matched retreat talk sample",
    [...result.matched.values()].slice(0, 5).map((talk) => ({
      publicationDate: talk.date,
      retreat: talk.retreat,
      retreatId: talk.retreatId,
      talkId: talk.talkId,
      title: talk.title,
    })),
  );

  return result;
}

function loadLookupState(): LookupState {
  const teacherRows = execLocalSql<{ dharmaSeedId: number }>(
    "select dharma_seed_id as dharmaSeedId from teachers;",
  );
  const centerRows = execLocalSql<{ dharmaSeedSubdomain: string }>(
    "select dharma_seed_subdomain as dharmaSeedSubdomain from centers;",
  );
  const retreatRows = execLocalSql<{ dharmaSeedId: number }>(
    "select dharma_seed_id as dharmaSeedId from retreats;",
  );

  const state: LookupState = {
    centerSubdomains: new Set(
      centerRows
        .map((row) => row.dharmaSeedSubdomain)
        .filter((value): value is string => typeof value === "string"),
    ),
    retreatIds: new Set(
      retreatRows
        .map((row) => row.dharmaSeedId)
        .filter((value): value is number => typeof value === "number"),
    ),
    teacherIds: new Set(
      teacherRows
        .map((row) => row.dharmaSeedId)
        .filter((value): value is number => typeof value === "number"),
    ),
  };

  logStep("loaded lookup state", {
    centers: state.centerSubdomains.size,
    retreats: state.retreatIds.size,
    teachers: state.teacherIds.size,
  });

  return state;
}

async function fetchTeacherWithRetry(teacherId: number) {
  return withRetry(() => fetchTeacherFromDharmaseed(teacherId), {
    initialDelay: 1500,
    maxAttempts: 3,
    maxDelay: 6000,
  });
}

async function ensureTeacher(
  talk: ScrapedTalk,
  dryRun: boolean,
  lookups: LookupState,
  teacherStatements: string[],
  teacherFetchCache: Map<number, Awaited<ReturnType<typeof fetchTeacherWithRetry>>>,
) {
  const teacherSeedId = talk.teacherUrl
    ? Number.parseInt(talk.teacherUrl.split("/").pop() ?? "0", 10)
    : null;

  if (!teacherSeedId) {
    throw new Error(`Talk ${talk.talkId} is missing a teacher id`);
  }

  if (lookups.teacherIds.has(teacherSeedId)) return teacherSeedId;

  let teacher = teacherFetchCache.get(teacherSeedId);
  if (!teacher) {
    teacher = await fetchTeacherWithRetry(teacherSeedId);
    teacherFetchCache.set(teacherSeedId, teacher);
  }

  if (!dryRun) {
    teacherStatements.push(`
      insert into teachers (
        name, slug, description, profile_image_url, website_url, donation_url,
        dharma_seed_id, published_on, created_at, updated_at
      ) values (
        ${sqlString(teacher.name)},
        ${sqlString(slugify(teacher.name, teacher.dharmaSeedId))},
        ${sqlString(teacher.description)},
        ${sqlString(teacher.profileImageUrl)},
        ${sqlString(teacher.websiteUrl)},
        ${sqlString(teacher.donationUrl)},
        ${sqlNumber(teacher.dharmaSeedId)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      on conflict(dharma_seed_id) do update set
        name = excluded.name,
        slug = excluded.slug,
        description = excluded.description,
        profile_image_url = excluded.profile_image_url,
        website_url = excluded.website_url,
        donation_url = excluded.donation_url,
        updated_at = CURRENT_TIMESTAMP;
    `);
  }

  lookups.teacherIds.add(teacherSeedId);
  return teacherSeedId;
}

function ensureCenter(
  talk: ScrapedTalk,
  dryRun: boolean,
  lookups: LookupState,
  statements: string[],
) {
  if (!talk.center || !talk.centerSubdomain) return null;

  if (lookups.centerSubdomains.has(talk.centerSubdomain)) {
    return talk.centerSubdomain;
  }

  if (!dryRun) {
    statements.push(`
      insert into centers (
        name, slug, description, dharma_seed_subdomain, created_at, updated_at
      ) values (
        ${sqlString(talk.center)},
        ${sqlString(slugify(talk.center, talk.centerSubdomain))},
        NULL,
        ${sqlString(talk.centerSubdomain)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      on conflict(dharma_seed_subdomain) do update set
        name = excluded.name,
        slug = excluded.slug,
        updated_at = CURRENT_TIMESTAMP;
    `);
  }

  lookups.centerSubdomains.add(talk.centerSubdomain);
  return talk.centerSubdomain;
}

function ensureRetreat(
  talk: ScrapedTalk,
  dryRun: boolean,
  lookups: LookupState,
  statements: string[],
) {
  if (!talk.retreat || !talk.retreatId) return null;

  if (lookups.retreatIds.has(talk.retreatId)) return talk.retreatId;

  if (!dryRun) {
    statements.push(`
      insert into retreats (
        title, slug, description, language, dharma_seed_id, last_build_date,
        created_at, updated_at
      ) values (
        ${sqlString(talk.retreat)},
        ${sqlString(slugify(talk.retreat, talk.retreatId))},
        NULL,
        'en',
        ${sqlNumber(talk.retreatId)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      on conflict(dharma_seed_id) do update set
        title = excluded.title,
        slug = excluded.slug,
        updated_at = CURRENT_TIMESTAMP;
    `);
  }

  lookups.retreatIds.add(talk.retreatId);
  return talk.retreatId;
}

async function backfillTeachers(flags: Flags) {
  const limitClause = flags.limit !== null ? ` limit ${flags.limit}` : "";
  const teachers = execLocalSql<{ dharmaSeedId: number; name: string }>(`
    select dharma_seed_id as dharmaSeedId, name
    from teachers
    where
      description is null
      or profile_image_url is null
      or website_url is null
      or donation_url is null
    order by dharma_seed_id asc${limitClause};
  `);

  logStep("starting teacher backfill", {
    dryRun: flags.dryRun,
    scanned: teachers.length,
  });

  let repaired = 0;
  const failed: Array<{ id: number; error: string }> = [];
  const statements: string[] = [];

  await withSpinnerAsync("fetching teacher metadata", async (spinner) => {
    const results = await mapConcurrent(
      teachers,
      TEACHER_FETCH_CONCURRENCY,
      async (teacher, index) => {
        try {
          const teacherData = await fetchTeacherWithRetry(
            Number(teacher.dharmaSeedId),
          );

          if (!flags.dryRun) {
            statements.push(`
              update teachers set
                name = ${sqlString(teacherData.name)},
                slug = ${sqlString(slugify(teacherData.name, teacherData.dharmaSeedId))},
                description = ${sqlString(teacherData.description)},
                profile_image_url = ${sqlString(teacherData.profileImageUrl)},
                website_url = ${sqlString(teacherData.websiteUrl)},
                donation_url = ${sqlString(teacherData.donationUrl)},
                updated_at = CURRENT_TIMESTAMP
              where dharma_seed_id = ${sqlNumber(teacherData.dharmaSeedId)};
            `);
          }

          repaired++;
          spinner.text = chalk.cyan(
            `fetching teacher metadata (${index + 1}/${teachers.length}, repaired=${repaired}, failed=${failed.length})`,
          );
        } catch (error) {
          failed.push({
            id: Number(teacher.dharmaSeedId),
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    );

    return results;
  });

  if (!flags.dryRun) {
    runLocalMutations(statements, "teacher metadata updates");
  }

  logStep("teacher backfill complete", {
    failed: failed.length,
    repaired,
    scanned: teachers.length,
  });

  return {
    failed,
    repaired,
    scanned: teachers.length,
  };
}

async function backfillTalks(flags: Flags) {
  const limitClause = flags.limit !== null ? ` limit ${flags.limit}` : "";
  const coreTargets = execLocalSql<CoreTalkTargetRow>(`
    select
      dharma_seed_id as dharmaSeedId,
      slug,
      case when description is null then 1 else 0 end as missingDescription,
      case when audio_url is null then 1 else 0 end as missingAudioUrl,
      case when publicationDate is null then 1 else 0 end as missingPublicationDate,
      case when center_id is null then 1 else 0 end as missingCenterId
    from talks
    where
      description is null
      or audio_url is null
      or publicationDate is null
      or center_id is null
    order by dharma_seed_id desc${limitClause};
  `);
  const retreatCandidateLimit = getRetreatCandidateLimit(flags.limit);
  const retreatCandidateClause =
    retreatCandidateLimit !== null ? ` limit ${retreatCandidateLimit}` : "";
  const retreatCandidates = execLocalSql<RetreatCandidateRow>(`
    select dharma_seed_id as dharmaSeedId
    from talks
    where retreat_id is null
    order by dharma_seed_id desc${retreatCandidateClause};
  `);

  logStep("starting talk backfill", {
    coreTargets: coreTargets.length,
    dryRun: flags.dryRun,
    missingAudioUrl: coreTargets.filter((talk) => talk.missingAudioUrl === 1).length,
    missingCenterId: coreTargets.filter((talk) => talk.missingCenterId === 1).length,
    missingDescription: coreTargets.filter((talk) => talk.missingDescription === 1)
      .length,
    missingPublicationDate: coreTargets.filter(
      (talk) => talk.missingPublicationDate === 1,
    ).length,
    retreatCandidates: retreatCandidates.length,
  });

  const coreTargetIds = coreTargets.map((talk) => Number(talk.dharmaSeedId));
  const fetchedCoreTalks = await fetchTalksById(coreTargetIds);
  const retreatCandidateIds = retreatCandidates.map((talk) =>
    Number(talk.dharmaSeedId),
  );
  const fetchedRetreatTalks = await discoverRetreatTalks(retreatCandidateIds);
  const matchedTalks = new Map<number, ScrapedTalk>(fetchedRetreatTalks.matched);
  for (const [talkId, talk] of fetchedCoreTalks.matched.entries()) {
    matchedTalks.set(talkId, talk);
  }

  const lookups = loadLookupState();
  const teacherFetchCache = new Map<
    number,
    Awaited<ReturnType<typeof fetchTeacherWithRetry>>
  >();
  const teacherStatements: string[] = [];
  const centerStatements: string[] = [];
  const retreatStatements: string[] = [];
  const talkStatements: string[] = [];
  let repaired = 0;
  let repairedTalksWithAudioUrl = 0;
  let repairedTalksWithPublicationDate = 0;
  let repairedTalksWithRetreat = 0;
  const failed: Array<{ id: number; error: string }> = [];
  const updateTargetIds = [...new Set([
    ...coreTargetIds,
    ...fetchedRetreatTalks.matched.keys(),
  ])];

  for (const [index, talkId] of updateTargetIds.entries()) {
    const talk = matchedTalks.get(talkId);
    if (!talk) {
      failed.push({ id: talkId, error: "Talk not found in rescrape scan" });
      continue;
    }

    try {
      const teacherSeedId = await ensureTeacher(
        talk,
        flags.dryRun,
        lookups,
        teacherStatements,
        teacherFetchCache,
      );
      const centerSubdomain = ensureCenter(
        talk,
        flags.dryRun,
        lookups,
        centerStatements,
      );
      const retreatSeedId = ensureRetreat(
        talk,
        flags.dryRun,
        lookups,
        retreatStatements,
      );
      const audioUrl = normalizeAudioUrl(talk.audioUrl);
      const publicationDate = parsePublicationDate(talk.date);
      const audioUrlValue = audioUrl === null ? "audio_url" : sqlString(audioUrl);
      const publicationDateValue =
        publicationDate === null ? "publicationDate" : sqlDate(publicationDate);

      if (!flags.dryRun) {
        talkStatements.push(`
          update talks set
            title = ${sqlString(talk.title)},
            slug = ${sqlString(slugify(talk.title, talk.talkId))},
            description = ${sqlString(talk.description)},
            audio_url = ${audioUrlValue},
            teacher_id = (
              select id from teachers
              where dharma_seed_id = ${sqlNumber(teacherSeedId)}
              limit 1
            ),
            center_id = ${
              centerSubdomain
                ? `(
              select id from centers
              where dharma_seed_subdomain = ${sqlString(centerSubdomain)}
              limit 1
            )`
                : "NULL"
            },
            retreat_id = ${
              retreatSeedId
                ? `(
              select id from retreats
              where dharma_seed_id = ${sqlNumber(retreatSeedId)}
              limit 1
            )`
                : "NULL"
            },
            duration = ${sqlNumber(sumTime(talk.time))},
            publicationDate = ${publicationDateValue},
            updated_at = CURRENT_TIMESTAMP
          where dharma_seed_id = ${sqlNumber(talk.talkId)};
        `);
      }

      repaired++;
      if (audioUrl) repairedTalksWithAudioUrl++;
      if (publicationDate) repairedTalksWithPublicationDate++;
      if (retreatSeedId) repairedTalksWithRetreat++;

      if (
        index === 0 ||
        (index + 1) % PROGRESS_INTERVAL === 0 ||
        index + 1 === updateTargetIds.length
      ) {
        logStep("talk backfill progress", {
          latestTalk: {
            audioUrl,
            hasAudioUrl: Boolean(audioUrl),
            hasPublicationDate: Boolean(publicationDate),
            publicationDate: publicationDate?.toISOString() ?? null,
            retreat: talk.retreat,
            retreatId: talk.retreatId,
            talkId,
            title: talk.title,
          },
          failed: failed.length,
          processed: index + 1,
          repaired,
          repairedTalksWithAudioUrl,
          repairedTalksWithPublicationDate,
          repairedTalksWithRetreat,
          total: updateTargetIds.length,
        });
      }
    } catch (error) {
      failed.push({
        id: talkId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (!flags.dryRun) {
    runLocalMutations(teacherStatements, "teacher upserts for talks");
    runLocalMutations(centerStatements, "center upserts for talks");
    runLocalMutations(retreatStatements, "retreat upserts for talks");
    runLocalMutations(talkStatements, "talk metadata updates");
  }

  logStep("talk backfill complete", {
    centersUpserted: centerStatements.length,
    corePagesScanned: fetchedCoreTalks.pagesScanned,
    failed: failed.length,
    missingAfterCoreScan: fetchedCoreTalks.missing.length,
    missingAfterRetreatDiscovery: fetchedRetreatTalks.missing.length,
    pagesScanned: Math.max(
      fetchedCoreTalks.pagesScanned,
      fetchedRetreatTalks.pagesScanned,
    ),
    repaired,
    repairedTalksWithAudioUrl,
    repairedTalksWithPublicationDate,
    repairedTalksWithRetreat,
    retreatDiscoveryPagesScanned: fetchedRetreatTalks.pagesScanned,
    retreatMatches: fetchedRetreatTalks.matched.size,
    retreatsUpserted: retreatStatements.length,
    scanned: coreTargets.length,
    stagedCenterUpserts: centerStatements.length,
    stagedRetreatUpserts: retreatStatements.length,
    stagedTalkUpdates: talkStatements.length,
    stagedTeacherUpserts: teacherStatements.length,
    teachersUpserted: teacherStatements.length,
  });
  logMetricsTable("Talk backfill summary", {
    centersUpserted: centerStatements.length,
    corePagesScanned: fetchedCoreTalks.pagesScanned,
    failed: failed.length,
    repaired,
    repairedTalksWithAudioUrl,
    repairedTalksWithPublicationDate,
    repairedTalksWithRetreat,
    retreatDiscoveryPagesScanned: fetchedRetreatTalks.pagesScanned,
    retreatMatches: fetchedRetreatTalks.matched.size,
    retreatsUpserted: retreatStatements.length,
    scanned: coreTargets.length,
    teachersUpserted: teacherStatements.length,
  });

  logSample(
    "Repaired talk sample",
    [...matchedTalks.values()].slice(0, 5).map((talk) => ({
      audioUrl: normalizeAudioUrl(talk.audioUrl),
      center: talk.center,
      hasAudioUrl: Boolean(talk.audioUrl),
      hasPublicationDate: Boolean(parsePublicationDate(talk.date)),
      publicationDate: parsePublicationDate(talk.date)?.toISOString() ?? null,
      retreat: talk.retreat,
      retreatId: talk.retreatId,
      title: talk.title,
    })),
  );

  return {
    centersUpserted: centerStatements.length,
    corePagesScanned: fetchedCoreTalks.pagesScanned,
    failed,
    missingAfterCoreScan: fetchedCoreTalks.missing,
    missingAfterRetreatDiscovery: fetchedRetreatTalks.missing,
    pagesScanned: Math.max(
      fetchedCoreTalks.pagesScanned,
      fetchedRetreatTalks.pagesScanned,
    ),
    repaired,
    repairedTalksWithAudioUrl,
    repairedTalksWithPublicationDate,
    repairedTalksWithRetreat,
    retreatDiscoveryPagesScanned: fetchedRetreatTalks.pagesScanned,
    retreatMatches: fetchedRetreatTalks.matched.size,
    retreatsUpserted: retreatStatements.length,
    scanned: coreTargets.length,
    teachersUpserted: teacherStatements.length,
  };
}

async function main() {
  const flags = parseFlags();
  const startedAt = Date.now();
  logStep("starting backfill", flags);
  const summary = {
    dryRun: flags.dryRun,
    talks: null as Awaited<ReturnType<typeof backfillTalks>> | null,
    teachers: null as Awaited<ReturnType<typeof backfillTeachers>> | null,
  };

  if (flags.teachers) {
    summary.teachers = await backfillTeachers(flags);
  }

  if (flags.talks) {
    summary.talks = await backfillTalks(flags);
  }

  logStep("backfill complete", {
    durationMs: Date.now() - startedAt,
  });
  logMetricsTable("Backfill summary", {
    durationMs: Date.now() - startedAt,
    ranTalks: summary.talks ? "yes" : "no",
    ranTeachers: summary.teachers ? "yes" : "no",
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
