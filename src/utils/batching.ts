import type { PrismaPromise } from "@prisma/client";
import { prisma } from "~/lib/prisma.server";

export const batchPrismaTransactions = async <T extends PrismaPromise<any>>(
  operations: T[],
  batchSize: number
) => {
  const batches: typeof operations[] = [];
  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize));
  }

  let transactionResults: ReturnType<typeof prisma.$transaction<T[]>>[] = [];
  for (const batch of batches) {
    console.log(`Batching ${batch.length} transactions...`);
    try {
      transactionResults = transactionResults.concat(
        await prisma.$transaction(batch)
      );
    } catch (e) {
      console.log(e);
      console.log(`Failure in batch ${batches.indexOf(batch)}, continuing...`);
      continue;
    }
  }

  return transactionResults;
};

export const batchExecute = async <T, P>(
  input: T[],
  func: (value: T) => Promise<P>,
  batchSize: number
) => {
  const batches: typeof input[] = [];
  for (let i = 0; i < input.length; i += batchSize) {
    batches.push(input.slice(i, i + batchSize));
  }

  let transactionResults: Awaited<ReturnType<typeof func>>[] = [];
  for (const batch of batches) {
    console.time("batch");
    transactionResults = transactionResults.concat(
      await Promise.all(batch.map(func))
    );
    console.timeEnd("batch");
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second wait
  }

  return transactionResults;
};
