import { beforeEach, expect, it, mock } from 'bun:test'

let visibility = 'public'
mock.module('../../repositories/trip.repository', () => ({ tripRepository: { getById: async () => ({ id: 'trip', userId: 'owner', visibility, shareSlug: 'secret', startDate: '2026-11-10', endDate: '2026-11-12' }), hasAccess: async (_id: string, userId: string) => userId === 'member' } }))
const { tripTrackAccess, editableTripTrack, assertTripTrackRange } = await import('./trip-track-access')
beforeEach(() => {
  visibility = 'public'
})
it('guests and unrelated authenticated users read the same owner track without edit rights', async () => {
  for (const user of [null, { id: 'stranger', role: 'user' }]) {
    expect(await tripTrackAccess('trip', user)).toMatchObject({ ownerId: 'owner', canEdit: false })
  }
  await expect(editableTripTrack('trip', { id: 'stranger', role: 'user' })).rejects.toThrow('участники')
})
it('owner and participants edit the owner track, never their own empty track', async () => {
  for (const id of ['owner', 'member'])
    expect(await editableTripTrack('trip', { id, role: 'user' })).toMatchObject({ ownerId: 'owner', canEdit: true })
})
it('private trips remain private; a valid share link grants read access only', async () => {
  visibility = 'private'
  await expect(tripTrackAccess('trip', null)).rejects.toThrow('доступа')
  await expect(tripTrackAccess('trip', { id: 'stranger', role: 'user' }, 'wrong')).rejects.toThrow('доступа')
  expect(await tripTrackAccess('trip', null, 'secret')).toMatchObject({ canEdit: false })
  expect(await editableTripTrack('trip', { id: 'member', role: 'user' })).toMatchObject({ canEdit: true })
})
it('rejects days and mutations outside the trip including a boundary-spanning interval', () => {
  const trip = { startDate: '2026-11-10', endDate: '2026-11-12' }
  expect(() => assertTripTrackRange(trip, Date.parse('2026-11-10T00:00:00Z'), Date.parse('2026-11-12T23:59:59.999Z'))).not.toThrow()
  for (const time of [Date.parse('2026-11-09T23:59:59Z'), Date.parse('2026-11-13T00:00:00Z'), NaN])
    expect(() => assertTripTrackRange(trip, time)).toThrow()
  expect(() => assertTripTrackRange(trip, Date.parse('2026-11-12T23:59:59Z'), Date.parse('2026-11-13T00:00:00Z'))).toThrow()
})
