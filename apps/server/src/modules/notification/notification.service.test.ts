import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const getTrip = mock(async () => ({ id: 'trip', title: 'Поездка' }))
const hasAccess = mock(async () => true)
const getDay = mock(async () => ({ tripId: 'trip' }))
const getWebTokens = mock(async (): Promise<Array<{ endpoint: string, keys: { p256dh: string, auth: string } }>> => [])
const getNativeTokens = mock(async (): Promise<Array<{ token: string }>> => [])
const deleteNativeToken = mock(async (_token: string) => {})
const deleteWebToken = mock(async (_endpoint: string) => {})
const sendWeb = mock(async (..._args: unknown[]) => {})
let fcmConfigured = true
class MockFcmRequestError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}
const sendFcm = mock(async (_token: string, _data: Record<string, string>): Promise<{ ok: boolean, status: number, errorCode?: string }> => ({ ok: true, status: 200 }))

mock.module('~/repositories/trip.repository', () => ({ tripRepository: { getById: getTrip, hasAccess } }))
mock.module('~/repositories/day.repository', () => ({ dayRepository: { findByIdWithOwner: getDay } }))
mock.module('~/repositories/notification.repository', () => ({
  notificationRepository: {
    getSubscribersTokens: getWebTokens,
    getSubscribersPushTokens: getNativeTokens,
    deletePushTokenByToken: deleteNativeToken,
    deletePushSubscription: deleteWebToken,
  },
}))
mock.module('~/lib/trpc', () => ({ createTRPCError: (code: string, message: string) => Object.assign(new Error(message), { code }) }))
mock.module('web-push', () => ({ default: { setVapidDetails: () => {}, sendNotification: sendWeb } }))
mock.module('./fcm', () => ({
  FcmRequestError: MockFcmRequestError,
  hasFcmServiceAccountConfigured: () => fcmConfigured,
  sendFcmMessage: sendFcm,
}))

const { notificationService } = await import('./notification.service')
const { MemoryNotificationDeliverySchema } = await import('./notification.schemas')
const originalVapidPublic = process.env.VAPID_PUBLIC_KEY
const originalVapidPrivate = process.env.VAPID_PRIVATE_KEY

afterAll(() => {
  if (originalVapidPublic === undefined)
    delete process.env.VAPID_PUBLIC_KEY
  else
    process.env.VAPID_PUBLIC_KEY = originalVapidPublic
  if (originalVapidPrivate === undefined)
    delete process.env.VAPID_PRIVATE_KEY
  else
    process.env.VAPID_PRIVATE_KEY = originalVapidPrivate
})

beforeEach(() => {
  for (const fn of [getTrip, hasAccess, getDay, getWebTokens, getNativeTokens, deleteNativeToken, deleteWebToken, sendWeb, sendFcm])
    fn.mockClear()
  getWebTokens.mockResolvedValue([])
  getNativeTokens.mockResolvedValue([])
  hasAccess.mockResolvedValue(true)
  sendFcm.mockResolvedValue({ ok: true, status: 200 })
  fcmConfigured = true
  process.env.VAPID_PUBLIC_KEY = 'configured'
  process.env.VAPID_PRIVATE_KEY = 'configured'
})

describe('memory notification delivery report', () => {
  test('reports zero recipients rather than pretending a notification was sent', async () => {
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(MemoryNotificationDeliverySchema.parse(report)).toEqual(report)
    expect(report.fcm.attempted).toBe(0)
    expect(report.fcm.accepted + report.web.accepted).toBe(0)
    expect(getNativeTokens).toHaveBeenCalledWith('trip', 'actor', 'fcm')
    expect(sendFcm).not.toHaveBeenCalled()
  })

  test('reports acceptance by FCM and supplies the Android data payload', async () => {
    getNativeTokens.mockResolvedValue([{ token: 'device-token' }])
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.fcm).toEqual({ attempted: 1, accepted: 1, failed: 0, skipped: 0, errorCodes: [] })
    expect(sendFcm).toHaveBeenCalledWith('device-token', expect.objectContaining({
      url: 'trip-scheduler://trip/trip?day=day&view=memories',
    }))
  })

  test('reports missing server credentials explicitly', async () => {
    getNativeTokens.mockResolvedValue([{ token: 'device-token' }])
    fcmConfigured = false
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.fcm).toEqual({ attempted: 1, accepted: 0, failed: 0, skipped: 1, errorCodes: ['NOT_CONFIGURED'] })
    expect(sendFcm).not.toHaveBeenCalled()
  })

  test('reports provider rejection without deleting a potentially valid token', async () => {
    getNativeTokens.mockResolvedValue([{ token: 'device-token' }])
    sendFcm.mockResolvedValue({ ok: false, status: 403, errorCode: 'SENDER_ID_MISMATCH' })
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.fcm.failed).toBe(1)
    expect(report.fcm.errorCodes).toEqual(['SENDER_ID_MISMATCH'])
    expect(deleteNativeToken).not.toHaveBeenCalled()
  })

  test('includes OAuth failures in the report', async () => {
    getNativeTokens.mockResolvedValue([{ token: 'device-token' }])
    sendFcm.mockRejectedValueOnce(new MockFcmRequestError('OAUTH_401'))
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.fcm.failed).toBe(1)
    expect(report.fcm.errorCodes).toEqual(['OAUTH_401'])
  })

  test('removes unregistered tokens and counts them as unsuccessful', async () => {
    getNativeTokens.mockResolvedValue([{ token: 'expired' }])
    sendFcm.mockResolvedValue({ ok: false, status: 404, errorCode: 'UNREGISTERED' })
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.fcm.failed).toBe(1)
    expect(deleteNativeToken).toHaveBeenCalledWith('expired')
  })

  test('does not hide failed Android delivery when web push succeeds', async () => {
    getWebTokens.mockResolvedValue([{ endpoint: 'https://push.example/device', keys: { p256dh: 'key', auth: 'auth' } }])
    getNativeTokens.mockResolvedValue([{ token: 'device-token' }])
    sendFcm.mockResolvedValue({ ok: false, status: 403, errorCode: 'PERMISSION_DENIED' })
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.web.accepted).toBe(1)
    expect(report.fcm.accepted).toBe(0)
    expect(report.fcm.failed).toBe(1)
  })

  test('keeps FCM working when browser VAPID credentials are absent', async () => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    getWebTokens.mockResolvedValue([{ endpoint: 'https://push.example/device', keys: { p256dh: 'key', auth: 'auth' } }])
    getNativeTokens.mockResolvedValue([{ token: 'device-token' }])
    const report = await notificationService.sendMemoryUpdate('actor', 'trip', 'day')
    expect(report.web.skipped).toBe(1)
    expect(report.web.errorCodes).toEqual(['NOT_CONFIGURED'])
    expect(report.fcm.accepted).toBe(1)
    expect(sendWeb).not.toHaveBeenCalled()
  })

  test('does not send anything for an actor without access', async () => {
    hasAccess.mockResolvedValueOnce(false)
    await expect(notificationService.sendMemoryUpdate('actor', 'trip', 'day')).rejects.toThrow('Нет доступа')
    expect(sendFcm).not.toHaveBeenCalled()
    expect(getNativeTokens).not.toHaveBeenCalled()
  })
})
