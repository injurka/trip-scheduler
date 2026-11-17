import type { IngestBatchInput } from './tracking.schemas'
import { TRPCError } from '@trpc/server'
import { db } from 'db'
import { nativeTrackingKeys } from 'db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { measureDbQuery } from '~/lib/db-monitoring'

const LIFETIME_MS = 30 * 86400_000
async function fingerprint(token: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return Array.from(new Uint8Array(hash), byte =>
    byte.toString(16).padStart(2, '0')).join('')
}
/** Separate device credential cannot authenticate as a user or rotate their refresh token. */
export async function grantNativeTracking(userId: string, deviceId: string) {
  const syncToken = `${crypto.randomUUID()}.${crypto.randomUUID()}`
  const tokenHash = await fingerprint(syncToken)
  const expiresAt = new Date(Date.now() + LIFETIME_MS)
  await measureDbQuery('native_tracking_keys', 'insert', () =>
    db
      .insert(nativeTrackingKeys)
      .values({ userId, deviceId, tokenHash, expiresAt })
      .onConflictDoUpdate({
        target: [nativeTrackingKeys.userId, nativeTrackingKeys.deviceId],
        set: { tokenHash, expiresAt },
      }))
  return { syncToken, expiresAt: expiresAt.getTime() }
}
export async function authorizeNativeTracking(
  syncToken: string,
  ownerId: string,
) {
  const tokenHash = await fingerprint(syncToken)
  const [credential] = await measureDbQuery(
    'native_tracking_keys',
    'select',
    () =>
      db
        .select()
        .from(nativeTrackingKeys)
        .where(
          and(
            eq(nativeTrackingKeys.tokenHash, tokenHash),
            eq(nativeTrackingKeys.userId, ownerId),
            gt(nativeTrackingKeys.expiresAt, new Date()),
          ),
        )
        .limit(1),
  )
  if (!credential) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message:
        'Войдите в приложение для восстановления фоновой отправки GPS. Точки сохранены на устройстве.',
    })
  }
  // Renew this device's isolated credential without changing a browser login session.
  const expiresAt = new Date(Date.now() + LIFETIME_MS)
  if (credential.expiresAt.getTime() - Date.now() < LIFETIME_MS - 86400_000) {
    await measureDbQuery('native_tracking_keys', 'update', () =>
      db
        .update(nativeTrackingKeys)
        .set({ expiresAt })
        .where(eq(nativeTrackingKeys.tokenHash, tokenHash)))
  }
  return credential.userId
}
export async function syncNativeTracking(
  input: IngestBatchInput & { ownerId: string, syncToken: string },
) {
  const owner = await authorizeNativeTracking(input.syncToken, input.ownerId)
  const { trackingService } = await import('./tracking.service')
  return trackingService.ingestBatch(owner, input, {
    materializeSegments: false,
  })
}
export async function revokeNativeTracking(userId: string, deviceId?: string) {
  await measureDbQuery('native_tracking_keys', 'delete', () =>
    db
      .delete(nativeTrackingKeys)
      .where(
        deviceId
          ? and(
              eq(nativeTrackingKeys.userId, userId),
              eq(nativeTrackingKeys.deviceId, deviceId),
            )
          : eq(nativeTrackingKeys.userId, userId),
      ))
  return { success: true }
}
