import type { Context } from 'hono'
import { generateTripCalendarIcs } from '@injurka/trip-calendar'
import { isRecord } from '@injurka/type-utils'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { buildContentDisposition } from '~/lib/content-disposition'
import { tripRepository } from '~/repositories/trip.repository'

export const calendarController = new Hono()

const UUID_REGEX = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

async function handleCalendar(c: Context) {
  let param = c.req.param('idOrSlug')
  if (!param) {
    throw new HTTPException(400, { message: 'ID или shareSlug не указан' })
  }

  if (param.endsWith('.ics')) {
    param = param.slice(0, -4)
  }

  const isUuid = UUID_REGEX.test(param)
  const trip = isUuid
    ? await tripRepository.getByIdWithDays(param)
    : await tripRepository.getByShareSlug(param)

  if (!trip) {
    throw new HTTPException(404, { message: 'Календарь поездки не найден' })
  }

  // Проверка прав доступа:
  // Если запрос сделан по shareSlug или поездка публичная — доступ разрешен (для подписок WebCal в Google/Apple Calendar).
  // Если запрос сделан по ID приватной поездки — требуется авторизация.
  if (isUuid && trip.visibility === 'private') {
    const token = c.req.query('token') || c.req.header('authorization')?.split(' ')[1]
    const user = token ? await authUtils.getUserFromToken(token) : null

    if (!user) {
      throw new HTTPException(401, { message: 'Требуется авторизация для доступа к календарю' })
    }

    const isAdmin = user.role === 'admin'
    const isOwner = trip.userId === user.id
    const isParticipant = isOwner || isAdmin ? true : await tripRepository.hasAccess(trip.id, user.id)

    if (!isAdmin && !isOwner && !isParticipant) {
      throw new HTTPException(403, { message: 'Нет доступа к календарю этой поездки' })
    }
  }

  const bookingSection = trip.sections?.find(s => s.type === 'bookings')
  const content = bookingSection?.content
  const bookings = isRecord(content) && Array.isArray(content.bookings) ? content.bookings : []

  const baseUrl = process.env.FRONTEND_URL || 'https://trip-scheduler.ru'
  const tripUrl = trip.shareSlug ? `${baseUrl}/trip/${trip.shareSlug}` : `${baseUrl}/trip/${trip.id}`

  const includeActivities = c.req.query('activities') !== '0' && c.req.query('activities') !== 'false'
  const includeBookings = c.req.query('bookings') !== '0' && c.req.query('bookings') !== 'false'
  const includeDaySummaries = c.req.query('days') === '1' || c.req.query('days') === 'true'
  const enableAlarms = c.req.query('alarms') !== '0' && c.req.query('alarms') !== 'false'

  const ics = generateTripCalendarIcs(
    {
      trip: {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        startDate: trip.startDate,
        endDate: trip.endDate,
        shareSlug: trip.shareSlug,
        cityRefs: trip.cityRefs,
        url: tripUrl,
      },
      days: trip.days,
      bookings,
    },
    {
      includeActivities,
      includeBookings,
      includeDaySummaries,
      enableAlarms,
      calendarName: trip.title,
    },
  )

  const filename = `trip_${trip.title.trim().replace(/[\\/:*?"<>|\r\n]+/g, '_') || 'calendar'}.ics`
  const bodyBytes = Buffer.from(ics, 'utf-8')
  const etag = `"${Bun.hash(ics).toString(16)}"`

  if (c.req.header('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    })
  }

  return new Response(c.req.method === 'HEAD' ? null : bodyBytes, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Length': String(bodyBytes.byteLength),
      'Content-Disposition': buildContentDisposition('inline', filename),
      'Cache-Control': 'no-cache, must-revalidate',
      'ETag': etag,
    },
  })
}

calendarController.on(['GET', 'HEAD'], '/:idOrSlug', handleCalendar)
calendarController.on(['GET', 'HEAD'], '/:idOrSlug/calendar', handleCalendar)
calendarController.on(['GET', 'HEAD'], '/:idOrSlug/calendar.ics', handleCalendar)
