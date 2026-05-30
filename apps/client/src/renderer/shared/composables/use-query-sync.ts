import { computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

let pendingQuery: Record<string, any> | null = null
let updatePromise: Promise<void> | null = null

export function useQuerySync<T>(
  key: string,
  defaultValue: T,
  options: {
    parse?: (val: string | string[]) => T
    serialize?: (val: T) => string | string[] | undefined
  } = {},
) {
  const route = useRoute()
  const router = useRouter()

  const updateQuery = (newVal: string | string[] | undefined) => {
    if (!pendingQuery) {
      pendingQuery = { ...route.query }
    }

    if (newVal === undefined || newVal === null || newVal === '') {
      delete pendingQuery[key]
    }
    else {
      pendingQuery[key] = newVal
    }

    if (!updatePromise) {
      updatePromise = nextTick(async () => {
        const queryToApply = { ...pendingQuery! }
        pendingQuery = null
        updatePromise = null

        if (JSON.stringify(route.query) !== JSON.stringify(queryToApply)) {
          await router.replace({ query: queryToApply }).catch(() => { })
        }
      })
    }
  }

  return computed<T>({
    get() {
      const val = route.query[key] as string | string[] | undefined
      if (val === undefined || val === null || val === '')
        return defaultValue
      if (options.parse)
        return options.parse(val)

      if (typeof defaultValue === 'number')
        return Number(val) as unknown as T
      if (typeof defaultValue === 'boolean')
        return (val === 'true') as unknown as T
      if (Array.isArray(defaultValue))
        return (Array.isArray(val) ? val : [val]) as unknown as T
      return val as unknown as T
    },
    set(newVal) {
      let isDefault = newVal === defaultValue || (newVal === '' && defaultValue === null)
      if (!isDefault && typeof newVal === 'object' && newVal !== null) {
        isDefault = JSON.stringify(newVal) === JSON.stringify(defaultValue)
      }

      if (isDefault) {
        updateQuery(undefined)
      }
      else {
        const serialized = options.serialize ? options.serialize(newVal) : (newVal as any)
        updateQuery(serialized)
      }
    },
  })
}
