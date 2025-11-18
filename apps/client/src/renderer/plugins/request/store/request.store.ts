export type RequestStatus = 'idle' | 'pending' | 'success' | 'error' | 'aborted'

export interface IRequestState {
  statuses: Map<string, RequestStatus>
  errors: Map<string, unknown | null>
  cache: Map<string, any>
  controllers: Map<string, AbortController>
}

export const useRequestStore = defineStore('request', {
  state: (): IRequestState => ({
    statuses: new Map(),
    errors: new Map(),
    cache: new Map(),
    controllers: new Map(),
  }),
  actions: {
    setStatus(key: string, status: RequestStatus) {
      this.statuses.set(key, status)
    },
    setError(key: string, error: unknown | null) {
      if (error) {
        this.errors.set(key, error)
      }
      else {
        this.errors.delete(key)
      }
    },
    setCache(key: string, data: any) {
      this.cache.set(key, data)
    },
    abort(key: string) {
      if (this.controllers.has(key)) {
        this.controllers.get(key)?.abort()
        this.controllers.delete(key)
      }
    },
    reset(key: string) {
      this.abort(key)
      this.statuses.set(key, 'idle')
      this.errors.delete(key)
      this.cache.delete(key)
    },
  },
})
