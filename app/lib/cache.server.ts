const CACHE_EPOCH_KEY = "cache:epoch";

const toJson = <T>(value: T) => JSON.stringify(value);

export const getCacheEpoch = async (kv?: KVNamespace) => {
  if (!kv) return "0";
  return (await kv.get(CACHE_EPOCH_KEY)) ?? "0";
};

export const bumpCacheEpoch = async (kv?: KVNamespace) => {
  if (!kv) return "0";
  const nextEpoch = Date.now().toString();
  await kv.put(CACHE_EPOCH_KEY, nextEpoch);
  return nextEpoch;
};

export const buildKvCacheKey = async (
  kv: KVNamespace | undefined,
  key: string,
) => {
  const epoch = await getCacheEpoch(kv);
  return `v${epoch}:${key}`;
};

export const getCachedJson = async <T>(
  kv: KVNamespace | undefined,
  key: string,
): Promise<T | null> => {
  if (!kv) return null;
  const cacheKey = await buildKvCacheKey(kv, key);
  const value = await kv.get(cacheKey);
  return value ? (JSON.parse(value) as T) : null;
};

export const putCachedJson = async <T>(
  kv: KVNamespace | undefined,
  key: string,
  value: T,
  expirationTtl: number,
) => {
  if (!kv) return;
  const cacheKey = await buildKvCacheKey(kv, key);
  await kv.put(cacheKey, toJson(value), { expirationTtl });
};

export const withCachedJson = async <T>(
  kv: KVNamespace | undefined,
  key: string,
  expirationTtl: number,
  loader: () => Promise<T>,
) => {
  const cached = await getCachedJson<T>(kv, key);
  if (cached !== null) return cached;

  const value = await loader();
  await putCachedJson(kv, key, value, expirationTtl);
  return value;
};
