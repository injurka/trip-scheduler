import type { Activity, ActivitySections, Day } from '~/shared/types/models/activity'
import type { Trip, TripWithDays } from '~/shared/types/models/trip'
import type { RouterOutput } from '~/shared/types/trpc'

type ActivityDto = RouterOutput['activity']['update']
type DayDto = RouterOutput['day']['update'] & { activities?: ActivityDto[] }
type TripDto = Omit<RouterOutput['trip']['getById'], 'participants'> & {
  participants?: RouterOutput['trip']['getById']['participants']
  sections?: Trip['sections']
}

export function normalizeActivity(activity: ActivityDto): Activity {
  const sections: ActivitySections = (activity.sections ?? []).map((section) => {
    const base = { ...section, title: section.title ?? undefined, icon: section.icon ?? undefined }

    switch (base.type) {
      case 'geolocation': {
        const normalizePoint = (point: typeof base.points[number]) => ({
          ...point,
          style: point.style ?? undefined,
          address: point.address ?? undefined,
          comment: point.comment ?? undefined,
        })

        return {
          ...base,
          points: base.points.map(normalizePoint),
          routes: base.routes.map(route => ({ ...route, points: route.points.map(normalizePoint) })),
          center: base.center ?? undefined,
          zoom: base.zoom ?? undefined,
        }
      }
      case 'metro':
        return {
          ...base,
          rides: base.rides.map(ride => ({
            ...ride,
            startStationId: ride.startStationId ?? null,
            endStationId: ride.endStationId ?? null,
            lineId: ride.lineId ?? null,
            lineNumber: ride.lineNumber ?? null,
          })),
        }
      case 'bus':
        return {
          ...base,
          rides: base.rides.map(ride => ({
            ...ride,
            code: ride.code ?? null,
            operator: ride.operator ?? null,
            walk: ride.walk ?? null,
          })),
        }
      default:
        return base
    }
  })

  return { ...activity, sections, tag: activity.tag ?? undefined }
}

export function normalizeDay(day: DayDto): Day {
  return {
    ...day,
    date: day.date ?? null,
    description: day.description ?? '',
    activities: (day.activities ?? []).map(normalizeActivity),
    meta: day.meta?.map(meta => ({
      ...meta,
      subtitle: meta.subtitle ?? undefined,
      icon: meta.icon ?? undefined,
      color: meta.color ?? undefined,
      content: meta.content ?? undefined,
    })),
  }
}

export function normalizeTrip(trip: TripDto): Trip {
  return {
    ...trip,
    participants: (trip.participants ?? []).map(participant => ({
      ...participant,
      name: participant.name ?? '',
      avatarUrl: participant.avatarUrl ?? '',
    })),
    sections: trip.sections ?? [],
  }
}

export function normalizeTripWithDays(trip: RouterOutput['trip']['getByIdWithDays']): TripWithDays {
  return { ...normalizeTrip(trip), days: trip.days.map(normalizeDay) }
}
