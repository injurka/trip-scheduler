import { computed, readonly, ref } from 'vue'

const STORAGE_KEY = 'trip-scheduler:forced-offline'

function readPreference(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
  }
  catch {
    return false
  }
}

const forcedOffline = ref(readPreference())
const networkOnline = ref(typeof navigator === 'undefined' || navigator.onLine !== false)
const isOnline = computed(() => networkOnline.value && !forcedOffline.value)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    networkOnline.value = true
  })
  window.addEventListener('offline', () => {
    networkOnline.value = false
  })
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null)
      forcedOffline.value = readPreference()
  })
}

export function setForcedOffline(value: boolean) {
  forcedOffline.value = value

  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  }
  catch {
    // The current session remains usable when browser storage is unavailable.
  }
}

export function useConnectivity() {
  return { isOnline, forcedOffline: readonly(forcedOffline), setForcedOffline }
}

export function isAppOnline(): boolean {
  return !forcedOffline.value && (typeof navigator === 'undefined' || navigator.onLine !== false)
}

export function requireAppOnline(): void {
  if (!isAppOnline())
    throw new TypeError('Нет подключения: включён офлайн-режим или сеть недоступна')
}

/** Check at dispatch time, including retries and requests queued by tRPC batching. */
function guardedFetch(...[input, init]: Parameters<typeof fetch>): Promise<Response> {
  try {
    requireAppOnline()
  }
  catch (error) {
    return Promise.reject(error)
  }

  return globalThis.fetch(input, init)
}

export const onlineFetch = Object.assign(guardedFetch, globalThis.fetch)
