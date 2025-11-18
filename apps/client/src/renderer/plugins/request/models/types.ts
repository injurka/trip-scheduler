import type { InjectionKey } from 'vue'
import type { IDatabaseClient } from '~/shared/services/api/model/types'

export interface RequestPluginOptions {
  databaseService: IDatabaseClient
}

export const DatabaseServiceKey: InjectionKey<IDatabaseClient> = Symbol('DatabaseService')

export type DatabaseFn<T> = (db: IDatabaseClient, signal: AbortSignal) => Promise<T>

export interface UseRequestOptions<T> {
  key: string
  fn: DatabaseFn<T>
  initialData?: T | null
  force?: boolean
  cache?: boolean
  abortOnUnmount?: boolean
  cancelPrevious?: boolean
  onSuccess?: (result: T) => void | Promise<void>
  onError?: (error: unknown) => void | Promise<void>
  onAbort?: () => void | Promise<void>
}
