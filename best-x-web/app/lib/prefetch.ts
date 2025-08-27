// 预取缓存
const prefetchCache = new Map<string, Promise<any>>();

// 预加载提取数据
export async function preloadExtraction(id: string | number) {
  const key = `extraction-${id}`;
  
  // 如果已经在预取，返回现有的 Promise
  if (prefetchCache.has(key)) {
    return prefetchCache.get(key);
  }
  
  // 创建预取 Promise
  const prefetchPromise = Promise.all([
    fetch(`http://localhost:3001/api/extractions/${id}`),
    fetch(`http://localhost:3001/api/extractions/${id}/article`)
  ]).then(([tweetsRes, articleRes]) => {
    return Promise.all([
      tweetsRes.json(),
      articleRes.ok ? articleRes.json() : null
    ]);
  }).catch(() => null);
  
  // 缓存 Promise
  prefetchCache.set(key, prefetchPromise);
  
  // 5分钟后清理缓存
  setTimeout(() => {
    prefetchCache.delete(key);
  }, 5 * 60 * 1000);
  
  return prefetchPromise;
}

// 获取预取的数据
export function getPrefetchedData(id: string | number) {
  const key = `extraction-${id}`;
  return prefetchCache.get(key);
}