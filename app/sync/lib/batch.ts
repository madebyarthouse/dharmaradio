import { withRetry } from "./retry";

export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  { batchSize = 10 } = {}
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => withRetry(() => processor(item)))
    );
    results.push(...batchResults);

    // Optional delay between batches to prevent rate limiting
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
