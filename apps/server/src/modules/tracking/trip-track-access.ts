import { TRPCError } from '@trpc/server'
import { tripRepository } from '~/repositories/trip.repository'

export async function tripTrackAccess(tripId: string, user?: { id: string, role: string } | null, shareSlug?: string) {
  const trip = await tripRepository.getById(tripId)
  if (!trip)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Путешествие не найдено' })
  const canEdit = !!user && (trip.userId === user.id || user.role === 'admin' || await tripRepository.hasAccess(tripId, user.id))
  if (!canEdit && trip.visibility !== 'public' && (!shareSlug || shareSlug !== trip.shareSlug))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Нет доступа к путешествию' })
  return { ownerId: trip.userId, canEdit, startDate: trip.startDate, endDate: trip.endDate }
}

export function assertTripTrackRange(access: { startDate: string, endDate: string }, start: number, end = start) {
  const from = Date.parse(`${access.startDate}T00:00:00Z`)
  const until = Date.parse(`${access.endDate}T00:00:00Z`) + 86400000
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < from || end >= until || end < start)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Трек должен находиться в пределах дат путешествия' })
}

export async function editableTripTrack(tripId: string, user: { id: string, role: string }) {
  const access = await tripTrackAccess(tripId, user)
  if (!access.canEdit)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Редактировать трек могут только участники путешествия' })
  return access
}
