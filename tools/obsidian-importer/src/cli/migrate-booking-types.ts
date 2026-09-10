import type { Booking } from '../types'
import process from 'node:process'
import { colors } from '../config/colors'
import { loadEnvIfAvailable } from '../config/env'
import { ApiClient } from '../lib/api-client'
import { reclassifyBookings } from '../lib/reclassify'
import { parseCliArgs } from './args'

/**
 * Разовая миграция уже импортированного путешествия под новую схему разделов
 * бронирований: «Авто» получает пометки `kind`, а неавтомобильные перемещения
 * (паромы, катера, канатные дороги, велосипеды) уезжают в раздел «Другое».
 *
 * Использование:
 *   bun run migrate:bookings --trip-id <uuid>            # предпросмотр (dry-run)
 *   bun run migrate:bookings --trip-id <uuid> --apply    # запись в базу
 *
 * Перед записью рядом с рабочим каталогом сохраняется бэкап содержимого
 * раздела (`./backups/<uuid>-bookings-<timestamp>.json`).
 */

const BOOKINGS_SECTION_TYPE = 'bookings'

interface SectionLike {
  id: string
  type: string
  title: string
  content?: { bookings?: Booking[] } & Record<string, unknown>
}

function backupPath(tripId: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${process.cwd()}/backups/${tripId}-bookings-${stamp}.json`
}

async function main(): Promise<void> {
  loadEnvIfAvailable()
  const options = parseCliArgs()
  const apply = process.argv.includes('--apply')

  if (!options.tripId) {
    console.error(`${colors.red}Укажите путешествие: --trip-id <uuid>${colors.reset}`)
    process.exit(1)
  }
  if (!options.email || !options.password) {
    console.error(`${colors.red}Нужны креды: ADMIN_EMAIL/ADMIN_PASSWORD или USER_EMAIL/USER_PASSWORD (или -e/-p).${colors.reset}`)
    process.exit(1)
  }

  const api = new ApiClient(options.apiUrl)
  process.stdout.write(`${colors.dim}🔐 Авторизация на ${options.apiUrl}...${colors.reset} `)
  await api.signIn(options.email, options.password)
  process.stdout.write(`${colors.green}ок${colors.reset}\n`)

  const details = await api.getTripDetails(options.tripId)
  const sections: SectionLike[] = details?.sections ?? details?.data?.sections ?? []
  const section = sections.find(item => item.type === BOOKINGS_SECTION_TYPE)
  if (!section) {
    console.error(`${colors.red}Раздел бронирований не найден.${colors.reset}`)
    process.exit(1)
  }

  const bookings: Booking[] = section.content?.bookings ?? []
  const { bookings: migrated, changes } = reclassifyBookings(bookings)

  const before = bookings.reduce<Record<string, number>>((acc, booking) => {
    const key = `${booking.type}${'kind' in booking.data && booking.data.kind ? `/${booking.data.kind}` : ''}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const after = migrated.reduce<Record<string, number>>((acc, booking) => {
    const key = `${booking.type}${'kind' in booking.data && booking.data.kind ? `/${booking.data.kind}` : ''}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  console.log(`\n${colors.bright}Раздел «${section.title}» (${bookings.length} записей)${colors.reset}`)
  for (const change of changes)
    console.log(`  ${colors.cyan}${change.from}${colors.reset} ➔ ${colors.green}${change.to}${colors.reset}  ${change.title}`)

  console.log(`\n${colors.bright}Было:${colors.reset} ${JSON.stringify(before)}`)
  console.log(`${colors.bright}Станет:${colors.reset} ${JSON.stringify(after)}`)

  if (changes.length === 0) {
    console.log(`\n${colors.green}Миграция не требуется.${colors.reset}\n`)
    return
  }

  const path = backupPath(options.tripId)
  await Bun.write(path, JSON.stringify(section.content, null, 2))
  console.log(`\n${colors.dim}Бэкап содержимого раздела: ${path}${colors.reset}`)

  if (!apply) {
    console.log(`${colors.yellow}Предпросмотр. Для записи добавьте --apply${colors.reset}\n`)
    return
  }

  await api.updateTripSection(section.id, { content: { ...section.content, bookings: migrated } })

  const verify = await api.getTripDetails(options.tripId)
  const verifySections: SectionLike[] = verify?.sections ?? verify?.data?.sections ?? []
  const verifyBookings: Booking[] = verifySections.find(item => item.type === BOOKINGS_SECTION_TYPE)?.content?.bookings ?? []
  const verifyCounts = verifyBookings.reduce<Record<string, number>>((acc, booking) => {
    const key = `${booking.type}${'kind' in booking.data && booking.data.kind ? `/${booking.data.kind}` : ''}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  console.log(`${colors.green}Записано. Проверка из базы:${colors.reset} ${JSON.stringify(verifyCounts)}\n`)
}

await main()
