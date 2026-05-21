// 内存缓存替代品（测试环境用）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const memoryCache = new Map<string, string>();

export const redis = {
  get(key: string): Promise<string | null> {
    return Promise.resolve(memoryCache.get(key) || null);
  },
  set(key: string, value: string): Promise<string | null> {
    memoryCache.set(key, value);
    return Promise.resolve('OK');
  },
  del(key: string): Promise<number> {
    memoryCache.delete(key);
    return Promise.resolve(1);
  },
  keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Promise.resolve(Array.from(memoryCache.keys()).filter(k => regex.test(k)));
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  on(_event: string, _callback: (...args: unknown[]) => void) {
    // no-op for test environment
  },
  quit(): Promise<string> {
    return Promise.resolve('OK');
  },
};
