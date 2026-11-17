import { invoke } from '@tauri-apps/api/core'
import { isMobileApp, SERVER_URL } from '~/shared/lib/env'
import { trackingService } from '~/shared/services/database/tracking.service'
import { trackingOwner } from './tracking-owner'

let active: Promise<void> | null = null
let configuredOwner: string | null = null
let revision = 0
let configuration = Promise.resolve()
function apply(config: Record<string, unknown> | null) {
  configuration = configuration
    .catch(() => {})
    .then(async () => {
      await invoke('tracking_configure', { config })
    })

  return configuration
}

if (isMobileApp && typeof window !== 'undefined') {
  window.addEventListener('tracking-owner-changed', () => {
    revision++
    configuredOwner = null
    void apply(null).catch(() => {})
  })
}

/** Scoped native key is independent of rotating browser access/refresh tokens. */
export async function ensureNativeTrackingSync() {
  if (!isMobileApp || !trackingOwner())
    return

  if (active)
    return active

  const ownerId = trackingOwner()!
  const version = revision
  active = (async () => {
    const health = await invoke<{
      ownerId?: string
      nativeSyncConfigured?: boolean
      nativeSyncError?: string
    }>('tracking_check_permissions')

    if (
      health.nativeSyncConfigured
      && health.ownerId === ownerId
      && !/Войдите|ключ/i.test(health.nativeSyncError ?? '')
    ) {
      configuredOwner = ownerId

      return
    }

    if (configuredOwner === ownerId && !health.nativeSyncError)
      return

    let deviceId = localStorage.getItem('tripscheduler-gps-device')

    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('tripscheduler-gps-device', deviceId)
    }

    const credential = await trackingService.grantNativeSync(deviceId)

    if (trackingOwner() !== ownerId || version !== revision)
      return

    await apply({
      ownerId,
      serverUrl: SERVER_URL,
      syncToken: credential.syncToken,
    })
    configuredOwner = ownerId
  })().finally(() => {
    active = null
  })

  return active
}
