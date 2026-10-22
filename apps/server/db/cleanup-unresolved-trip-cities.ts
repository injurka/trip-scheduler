/* eslint-disable no-console */
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { asc, eq, sql } from 'drizzle-orm'
import { db, pool } from './index'
import { geoResolutionAudit, tripGeoPlaces, trips } from './schema'

interface LinkSnapshot {
  tripId: string
  position: number
  placeId: string | null
  legacyLabel: string | null
  status: 'resolved' | 'unresolved' | 'needs_review'
  createdAt: string
  updatedAt: string
}

interface RemovedCity {
  position: number
  label: string
}

interface UnlinkedCity {
  position: number
  label: string
}

interface CleanupItem {
  tripId: string
  title: string
  beforeFingerprint: string
  beforeCities: string[]
  beforeLinks: LinkSnapshot[]
  afterCities: string[]
  afterLinks: LinkSnapshot[]
  removed: RemovedCity[]
  unlinkedCities: UnlinkedCity[]
}

interface CleanupManifest {
  format: 'trip-scheduler-unresolved-trip-city-cleanup'
  version: 1
  runId: string
  createdAt: string
  items: CleanupItem[]
}

function stableValue(value: any): any {
  if (value instanceof Date)
    return value.toISOString()
  if (Array.isArray(value))
    return value.map(stableValue)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')
}

function toLinkSnapshot(link: typeof tripGeoPlaces.$inferSelect): LinkSnapshot {
  return {
    tripId: link.tripId,
    position: link.position,
    placeId: link.placeId,
    legacyLabel: link.legacyLabel,
    status: link.status,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  }
}

function toDatabaseLink(link: LinkSnapshot) {
  return {
    ...link,
    createdAt: new Date(link.createdAt),
    updatedAt: new Date(link.updatedAt),
  }
}

function cityFingerprint(cities: string[], links: LinkSnapshot[]): string {
  return fingerprint({ cities, links })
}

function buildCleanupItem(
  trip: { id: string, title: string, cities: string[] },
  links: LinkSnapshot[],
): CleanupItem | null {
  const unresolvedLinks = links.filter(link => link.status !== 'resolved' || !link.placeId)
  if (unresolvedLinks.length === 0)
    return null

  const removedPositions = new Set(unresolvedLinks.map(link => link.position))
  const beforeCities = Array.isArray(trip.cities) ? trip.cities : []
  const validLinks = links.filter(link => link.status === 'resolved' && link.placeId)
  const afterLinks = validLinks.map((link) => {
    const removedBefore = [...removedPositions].filter(position => position < link.position).length
    return { ...link, position: link.position - removedBefore }
  })
  const afterCities = beforeCities.filter((_, position) => !removedPositions.has(position))
  const linkedPositions = new Set(links.map(link => link.position))

  return {
    tripId: trip.id,
    title: trip.title,
    beforeFingerprint: cityFingerprint(beforeCities, links),
    beforeCities,
    beforeLinks: links,
    afterCities,
    afterLinks,
    removed: unresolvedLinks.map((link) => {
      const fromProjection = beforeCities[link.position]?.trim()
      const fromLink = link.legacyLabel?.trim()
      return {
        position: link.position,
        label: fromProjection || fromLink || '(без подписи)',
      }
    }),
    unlinkedCities: beforeCities.flatMap((label, position) =>
      label.trim() && !linkedPositions.has(position)
        ? [{ position, label }]
        : []),
  }
}

async function collectCleanupItems(): Promise<CleanupItem[]> {
  const [tripRows, linkRows] = await Promise.all([
    db.select({ id: trips.id, title: trips.title, cities: trips.cities }).from(trips),
    db.select().from(tripGeoPlaces).orderBy(asc(tripGeoPlaces.tripId), asc(tripGeoPlaces.position)),
  ])

  const linksByTrip = new Map<string, LinkSnapshot[]>()
  for (const row of linkRows) {
    const links = linksByTrip.get(row.tripId) ?? []
    links.push(toLinkSnapshot(row))
    linksByTrip.set(row.tripId, links)
  }

  return tripRows.flatMap((trip) => {
    const item = buildCleanupItem(trip, linksByTrip.get(trip.id) ?? [])
    return item ? [item] : []
  })
}

function parseArgs(argv: string[]) {
  const [command = 'help', ...rest] = argv
  const flags = new Map<string, string | true>()
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index]!
    if (!flag.startsWith('--'))
      throw new Error(`Неизвестный аргумент: ${flag}`)
    const next = rest[index + 1]
    if (next && !next.startsWith('--')) {
      flags.set(flag, next)
      index++
    }
    else {
      flags.set(flag, true)
    }
  }
  return { command, flags }
}

function requiredFlag(flags: Map<string, string | true>, flag: string): string {
  const value = flags.get(flag)
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Требуется ${flag}`)
  return value
}

async function writePrivateJson(filePath: string, value: unknown): Promise<string> {
  const absolutePath = path.resolve(filePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 })
  await fs.writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await fs.chmod(absolutePath, 0o600)
  return absolutePath
}

async function createManifest(outputPath: string): Promise<void> {
  const manifest: CleanupManifest = {
    format: 'trip-scheduler-unresolved-trip-city-cleanup',
    version: 1,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    items: await collectCleanupItems(),
  }
  const reportPath = await writePrivateJson(outputPath, manifest)
  const removedCount = manifest.items.reduce((sum, item) => sum + item.removed.length, 0)
  const unlinkedCount = manifest.items.reduce((sum, item) => sum + item.unlinkedCities.length, 0)
  console.info(JSON.stringify({
    runId: manifest.runId,
    trips: manifest.items.length,
    unresolvedCityLinks: removedCount,
    unlinkedCityLabelsLeftUntouched: unlinkedCount,
    reportPath,
    affected: manifest.items.map(item => ({
      tripId: item.tripId,
      title: item.title,
      removing: item.removed,
      keeping: item.afterCities,
      unlinkedLeftUntouched: item.unlinkedCities,
    })),
    note: 'Поездки и список городов не изменены. Применение возможно только с отдельным --apply.',
  }, null, 2))
}

function assertManifest(value: any): asserts value is CleanupManifest {
  if (!value || value.format !== 'trip-scheduler-unresolved-trip-city-cleanup' || value.version !== 1 || typeof value.runId !== 'string' || !Array.isArray(value.items))
    throw new Error('Неизвестный формат отчёта очистки городов')
}

async function readManifest(filePath: string): Promise<CleanupManifest> {
  const manifest = JSON.parse(await fs.readFile(path.resolve(filePath), 'utf-8'))
  assertManifest(manifest)
  return manifest
}

function comparableCleanupItem(item: CleanupItem) {
  return {
    tripId: item.tripId,
    beforeFingerprint: item.beforeFingerprint,
    beforeCities: item.beforeCities,
    beforeLinks: item.beforeLinks,
    afterCities: item.afterCities,
    afterLinks: item.afterLinks,
    removed: item.removed,
    unlinkedCities: item.unlinkedCities,
  }
}

async function validateManifest(manifest: CleanupManifest): Promise<CleanupItem[]> {
  const currentItems = await collectCleanupItems()
  const currentByTripId = new Map(currentItems.map(item => [item.tripId, item]))
  if (currentByTripId.size !== manifest.items.length)
    throw new Error('Список городов изменился после отчёта; создайте новый audit')

  const seen = new Set<string>()
  const validated: CleanupItem[] = []
  for (const item of manifest.items) {
    if (seen.has(item.tripId))
      throw new Error(`Повтор поездки в отчёте: ${item.tripId}`)
    seen.add(item.tripId)
    const current = currentByTripId.get(item.tripId)
    if (!current || fingerprint(comparableCleanupItem(current)) !== fingerprint(comparableCleanupItem(item)))
      throw new Error(`Города поездки изменились после отчёта: ${item.tripId}`)
    validated.push(current)
  }
  return validated
}

async function readCurrentCitySnapshot(tx: any, tripId: string, lock = false) {
  let tripQuery = tx.select({ id: trips.id, title: trips.title, cities: trips.cities }).from(trips).where(eq(trips.id, tripId))
  let linksQuery = tx.select().from(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, tripId)).orderBy(asc(tripGeoPlaces.position))
  if (lock) {
    tripQuery = tripQuery.for('update')
    linksQuery = linksQuery.for('update')
  }
  const [tripRows, linkRows] = await Promise.all([tripQuery, linksQuery])
  const trip = tripRows[0]
  if (!trip)
    throw new Error(`Поездка ${tripId} удалена после audit`)
  const links = linkRows.map(toLinkSnapshot)
  const cities = Array.isArray(trip.cities) ? trip.cities : []
  return { trip, links, cities, fingerprint: cityFingerprint(cities, links) }
}

async function applyManifest(manifest: CleanupManifest, shouldApply: boolean): Promise<void> {
  const existingRun = await db.select({ id: geoResolutionAudit.id })
    .from(geoResolutionAudit)
    .where(eq(geoResolutionAudit.migrationRunId, manifest.runId))
    .limit(1)
  if (existingRun.length > 0) {
    console.info(`Run ${manifest.runId} уже записан в audit; повторное применение не выполнялось.`)
    return
  }

  const items = await validateManifest(manifest)
  console.info(JSON.stringify({
    runId: manifest.runId,
    mode: shouldApply ? 'apply' : 'dry-run',
    trips: items.length,
    unresolvedCityLinks: items.reduce((sum, item) => sum + item.removed.length, 0),
    tripFieldsChanged: ['cities'],
    cityLinksChanged: true,
  }, null, 2))
  if (!shouldApply || items.length === 0)
    return

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw('SELECT pg_advisory_xact_lock(hashtext(\'trip-scheduler-geo-backfill\'))'))
    const repeatedRun = await tx.select({ id: geoResolutionAudit.id })
      .from(geoResolutionAudit)
      .where(eq(geoResolutionAudit.migrationRunId, manifest.runId))
      .limit(1)
    if (repeatedRun.length > 0)
      throw new Error(`Run ${manifest.runId} уже применён`)

    const auditRows = []
    for (const item of items) {
      const current = await readCurrentCitySnapshot(tx, item.tripId, true)
      if (current.fingerprint !== item.beforeFingerprint)
        throw new Error(`Данные городов поездки ${item.tripId} изменились; транзакция отменена`)

      await tx.delete(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, item.tripId))
      if (item.afterLinks.length > 0) {
        await tx.insert(tripGeoPlaces).values(item.afterLinks.map((link) => {
          const next = toDatabaseLink(link)
          return { ...next, updatedAt: new Date() }
        }))
      }
      await tx.update(trips).set({ cities: item.afterCities }).where(eq(trips.id, item.tripId))

      const after = await readCurrentCitySnapshot(tx, item.tripId)
      auditRows.push({
        migrationRunId: manifest.runId,
        entityType: 'trip',
        entityId: item.tripId,
        fieldPath: 'cities',
        position: null,
        sourceLabel: item.removed.map(city => city.label).join(', ').slice(0, 500) || 'unresolved city link',
        context: {
          cleanupSnapshot: {
            beforeCities: item.beforeCities,
            beforeLinks: item.beforeLinks,
          },
          removed: item.removed,
        },
        status: 'unresolved' as const,
        reason: 'unresolved_trip_cities_removed',
        candidates: [],
        chosenPlaceId: null,
        ruleProvenance: {
          method: 'remove_unresolved_trip_cities',
          applied: true,
          afterFingerprint: after.fingerprint,
        },
        beforeFingerprint: item.beforeFingerprint,
      })
    }
    await tx.insert(geoResolutionAudit).values(auditRows)
  })

  console.info(`Run ${manifest.runId} применён одной транзакцией. Остальные поля поездок не изменялись.`)
}

async function rollbackRun(runId: string, shouldApply: boolean): Promise<void> {
  const rows = await db.select().from(geoResolutionAudit).where(eq(geoResolutionAudit.migrationRunId, runId))
  const cleanupRows = rows.filter((row) => {
    const provenance = row.ruleProvenance as Record<string, any>
    return row.entityType === 'trip' && row.fieldPath === 'cities' && provenance?.method === 'remove_unresolved_trip_cities'
  })
  if (cleanupRows.length === 0)
    throw new Error(`Cleanup run ${runId} не найден`)

  const pending = cleanupRows.filter(row => !(row.ruleProvenance as Record<string, any>)?.rolledBackAt)
  const conflicts: string[] = []
  for (const row of pending) {
    const expected = (row.ruleProvenance as Record<string, any>).afterFingerprint
    const current = await readCurrentCitySnapshot(db, row.entityId)
    if (!expected || current.fingerprint !== expected)
      conflicts.push(row.entityId)
  }

  if (!shouldApply) {
    console.info(JSON.stringify({
      runId,
      mode: 'dry-run',
      trips: pending.length,
      conflicts,
      wouldRollback: pending.length > 0 && conflicts.length === 0,
    }, null, 2))
    return
  }
  if (conflicts.length > 0)
    throw new Error(`Откат остановлен: после очистки города поездок менялись (${conflicts.join(', ')})`)
  if (pending.length === 0) {
    console.info(`Run ${runId} уже отменён.`)
    return
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw('SELECT pg_advisory_xact_lock(hashtext(\'trip-scheduler-geo-backfill\'))'))
    for (const row of pending) {
      const current = await readCurrentCitySnapshot(tx, row.entityId, true)
      const provenance = row.ruleProvenance as Record<string, any>
      if (current.fingerprint !== provenance.afterFingerprint)
        throw new Error(`Откат отменён: города поездки ${row.entityId} изменились`)

      const context = row.context as Record<string, any>
      const snapshot = context.cleanupSnapshot as { beforeCities: string[], beforeLinks: LinkSnapshot[] } | undefined
      if (!snapshot || !Array.isArray(snapshot.beforeCities) || !Array.isArray(snapshot.beforeLinks))
        throw new Error(`В audit отсутствует резервная копия городов поездки ${row.entityId}`)

      await tx.update(trips).set({ cities: snapshot.beforeCities }).where(eq(trips.id, row.entityId))
      await tx.delete(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, row.entityId))
      if (snapshot.beforeLinks.length > 0) {
        await tx.insert(tripGeoPlaces).values(snapshot.beforeLinks.map(toDatabaseLink))
      }
      await tx.update(geoResolutionAudit)
        .set({ ruleProvenance: { ...provenance, rolledBackAt: new Date().toISOString() } })
        .where(eq(geoResolutionAudit.id, row.id))
    }
  })
  console.info(`Run ${runId} отменён; прежние города и связи восстановлены.`)
}

function printHelp(): void {
  console.info([
    'Команды очистки неразрешённых городов поездок:',
    '  audit --output <report.json>',
    '  apply --mapping <report.json> [--apply]',
    '  rollback --run-id <runId> [--apply]',
    'Без --apply команды apply и rollback только показывают план.',
  ].join('\n'))
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2))
  if (command === 'audit') {
    await createManifest(requiredFlag(flags, '--output'))
  }
  else if (command === 'apply') {
    await applyManifest(await readManifest(requiredFlag(flags, '--mapping')), flags.get('--apply') === true)
  }
  else if (command === 'rollback') {
    await rollbackRun(requiredFlag(flags, '--run-id'), flags.get('--apply') === true)
  }
  else {
    printHelp()
  }
}

main()
  .catch((error) => {
    console.error('Trip city cleanup failed:', error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
