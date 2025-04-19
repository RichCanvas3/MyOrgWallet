// cacheService.ts
const CACHE_NAME = "app-cache";

export const getCache = async () => {
  return await caches.open(CACHE_NAME);
};

export const getCachedResponse = async (key: string): Promise<any | null> => {
  const cache = await getCache();
  return cache.match(key);
};

export const putCachedResponse = async (key: string, response: Response) => {
  const cache = await getCache();
  await cache.put(key, response.clone()); // clone so the original can still be used
};

export const putCachedValue = async (key: string, value: any) => {

  const response = new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });

  const cache = await getCache();
  await cache.put(key, response); // clone so the original can still be used
};



export const deleteCachedResponse = async (key: string) => {
  const cache = await getCache();
  await cache.delete(key);
};

export const clearCache = async () => {
  await caches.delete(CACHE_NAME);
};
