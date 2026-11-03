export class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

export function memoryCaches() {
  const data = new Map<string, Map<string, Response>>()
  const key = (request: RequestInfo | URL) => request instanceof Request ? request.url : String(request)
  const api = {
    keys: async () => [...data.keys()],
    delete: async (name: string) => data.delete(name),
    open: async (name: string) => {
      if (!data.has(name))
        data.set(name, new Map())

      const entries = data.get(name)!

      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        match: async (request: RequestInfo | URL) => entries.get(key(request))?.clone(),
        put: async (request: RequestInfo | URL, response: Response) => { entries.set(key(request), response.clone()) },
        delete: async (request: RequestInfo | URL) => entries.delete(key(request)),
      } as unknown as Cache
    },
  } as unknown as CacheStorage

  return { api, data }
}
