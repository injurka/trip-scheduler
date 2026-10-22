/* eslint-disable no-console */
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { geoRepository } from '../src/repositories/geo.repository'
import { db, pool } from './index'
import {
  cityWeatherCache,
  destinationReviews,
  geoCatalogCountries,
  geoCatalogVersions,
  geoPlaceNames,
  geoResolutionAudit,
  highlights,
  metroSystems,
  tripGeoPlaces,
  trips,
  tripSections,
} from './schema'

type EntityType = 'trip' | 'highlight' | 'destination_review' | 'metro' | 'flight'

interface MigrationItem {
  key: string
  entityType: EntityType
  entityId: string
  fieldPath: string
  position: number | null
  sourceLabel: string
  sourceFingerprint: string
  countryId?: string | null
  countryCode?: string | null
  beforeLink?: Record<string, any> | null
  beforeGeoPlaceId?: string | null
  beforeCityId?: string | null
  beforeCityIdPresent?: boolean
  candidates: Array<Record<string, any>>
  status: 'resolved' | 'unresolved' | 'needs_review'
  reason: string
  placeId: string | null
  chosenPlaceCountryId?: string | null
  decisionSource: 'exact_preferred_in_country' | 'reviewed_mapping' | null
  reviewed: boolean
  reviewedBy?: string
  note?: string
  pathParts?: Array<string | number>
}

interface MigrationManifest {
  format: 'trip-scheduler-geo-backfill'
  version: 1
  runId: string
  createdAt: string
  catalogVersion: string | null
  weatherCache: { rows: number, distinctCities: number }
  decisions: MigrationItem[]
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

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function itemKey(entityType: EntityType, entityId: string, fieldPath: string, position: number | null): string {
  return [entityType, entityId, fieldPath, position ?? ''].join('|')
}

function tripSourceSnapshot(trip: any, link: any | null) {
  return { id: trip.id, cities: trip.cities ?? [], updatedAt: trip.updatedAt, link: link ?? null }
}

function setAtPath(value: any, pathParts: Array<string | number>, next: any): void {
  let current = value
  for (const part of pathParts.slice(0, -1))
    current = current[part]
  current[pathParts[pathParts.length - 1]!] = next
}

function unsetAtPath(value: any, pathParts: Array<string | number>): void {
  let current = value
  for (const part of pathParts.slice(0, -1))
    current = current?.[part]
  if (current && pathParts.length > 0)
    delete current[pathParts[pathParts.length - 1]!]
}

const metroCountryCodeCache = new Map<string, Promise<string | null>>()

async function getMetroCountryCode(countryLabel: string): Promise<string | null> {
  const normalized = normalizeName(countryLabel)
  if (!normalized)
    return null
  const cached = metroCountryCodeCache.get(normalized)
  if (cached)
    return cached
  const lookup = db.select({ code: geoCatalogCountries.code, sourceName: geoCatalogCountries.sourceName, asciiName: geoCatalogCountries.asciiName, nameRu: geoCatalogCountries.nameRu })
    .from(geoCatalogCountries)
    .then((rows) => {
      const matches = rows.filter(row => [row.sourceName, row.asciiName, row.nameRu].some(name => name && normalizeName(name) === normalized))
      return new Set(matches.map(row => row.code)).size === 1 ? matches[0]!.code : null
    })
  metroCountryCodeCache.set(normalized, lookup)
  return lookup
}

async function makeDecision(item: MigrationItem, catalogReady: boolean): Promise<MigrationItem> {
  if (!catalogReady) {
    item.status = 'needs_review'
    item.reason = 'catalog_unavailable'
    return item
  }

  const resolution = await geoRepository.resolveExact({
    label: item.sourceLabel,
    ...(item.countryId ? { countryId: item.countryId } : {}),
    ...(item.countryCode ? { countryCode: item.countryCode } : {}),
    kinds: ['settlement'],
  })
  item.candidates = resolution.candidates.map(candidate => ({
    placeId: candidate.place.id,
    name: candidate.place.name,
    countryId: candidate.place.countryId,
    countryCode: candidate.place.countryCode,
    countryName: candidate.place.countryName,
    regionName: candidate.place.regionName,
    kind: candidate.place.kind,
    matchedName: candidate.matchedName,
  }))
  item.status = resolution.status
  item.reason = resolution.reason

  // Точного совпадения нет — для ручного разбора добавляем кандидатов prefix-поиском
  // БЕЗ фильтра страны: иначе кросс-кодовые случаи (например, «Гонконг» у записи
  // со страной Китай, а место в каталоге под кодом HK) остаются с пустым списком вариантов.
  if (item.status === 'unresolved' && item.candidates.length === 0) {
    const suggestions = await geoRepository.search({ query: item.sourceLabel, locale: 'ru', limit: 10 })
    if (suggestions.length > 0) {
      item.candidates = suggestions.map(result => ({
        placeId: result.id,
        name: result.name,
        countryId: result.countryId,
        countryCode: result.countryCode,
        countryName: result.countryName,
        regionName: result.regionName,
        kind: result.kind,
        matchedName: result.matchedName,
      }))
      item.status = 'needs_review'
      item.reason = 'prefix_candidates_for_review'
    }
  }

  const hasCountryContext = Boolean(item.countryId || item.countryCode)
  if (resolution.status === 'resolved' && resolution.place && hasCountryContext) {
    const matchedName = resolution.candidates.find(candidate => candidate.place.id === resolution.place!.id)?.matchedName
    const [preferredName] = await db.select({ id: geoPlaceNames.id })
      .from(geoPlaceNames)
      .where(and(
        eq(geoPlaceNames.placeId, resolution.place.id),
        eq(geoPlaceNames.normalizedName, normalizeName(item.sourceLabel)),
        ...(matchedName ? [eq(geoPlaceNames.name, matchedName)] : []),
        inArray(geoPlaceNames.language, ['ru', 'en', '']),
        eq(geoPlaceNames.isPreferred, true),
        eq(geoPlaceNames.isHistorical, false),
      ))
      .limit(1)
    const countryMatches = item.countryId
      ? resolution.place.countryId === item.countryId
      : item.countryCode === resolution.place.countryCode

    if (preferredName && countryMatches) {
      item.status = 'resolved'
      item.reason = 'unique_preferred_exact_name_with_country_context'
      item.placeId = resolution.place.id
      item.decisionSource = 'exact_preferred_in_country'
    }
  }

  if (!item.placeId && resolution.candidates.length > 0) {
    item.status = 'needs_review'
    if (!hasCountryContext)
      item.reason = 'country_or_region_context_required'
  }
  return item
}

async function collectMigrationItems(catalogReady: boolean): Promise<MigrationItem[]> {
  const [tripRows, tripLinks, highlightRows, reviewRows, metroRows, sections] = await Promise.all([
    db.select().from(trips),
    db.select().from(tripGeoPlaces),
    db.select().from(highlights),
    db.select().from(destinationReviews),
    db.select().from(metroSystems),
    db.select().from(tripSections).where(eq(tripSections.type, 'bookings')),
  ])
  const linksByTrip = new Map<string, Map<number, any>>()
  for (const link of tripLinks) {
    const byPosition = linksByTrip.get(link.tripId) ?? new Map<number, any>()
    byPosition.set(link.position, link)
    linksByTrip.set(link.tripId, byPosition)
  }

  const pending: MigrationItem[] = []
  for (const trip of tripRows) {
    const labels = Array.isArray(trip.cities) ? trip.cities : []
    const links = linksByTrip.get(trip.id) ?? new Map()
    const positions = new Set<number>([
      ...labels.map((_: string, index: number) => index),
      ...[...links.entries()].filter(([, link]) => link.status !== 'resolved').map(([position]) => position),
    ])
    for (const position of [...positions].sort((a, b) => a - b)) {
      const link = links.get(position) ?? null
      if (link?.status === 'resolved' && link.placeId)
        continue
      const sourceLabel = (typeof labels[position] === 'string' ? labels[position]!.trim() : '') || link?.legacyLabel?.trim() || ''
      if (!sourceLabel)
        continue
      pending.push({
        key: itemKey('trip', trip.id, 'cities', position),
        entityType: 'trip',
        entityId: trip.id,
        fieldPath: 'cities',
        position,
        sourceLabel,
        sourceFingerprint: fingerprint(tripSourceSnapshot(trip, link)),
        beforeLink: link,
        candidates: [],
        status: 'unresolved',
        reason: 'not_resolved',
        placeId: null,
        decisionSource: null,
        reviewed: false,
      })
    }
  }

  for (const row of highlightRows) {
    if (!row.geoPlaceId && row.city.trim()) {
      pending.push({
        key: itemKey('highlight', row.id, 'geoPlaceId', null),
        entityType: 'highlight',
        entityId: row.id,
        fieldPath: 'geoPlaceId',
        position: null,
        sourceLabel: row.city,
        sourceFingerprint: fingerprint(row),
        countryId: row.countryId,
        beforeGeoPlaceId: row.geoPlaceId,
        candidates: [],
        status: 'unresolved',
        reason: 'not_resolved',
        placeId: null,
        decisionSource: null,
        reviewed: false,
      })
    }
  }
  for (const row of reviewRows) {
    if (row.type === 'city' && !row.geoPlaceId && row.city?.trim()) {
      pending.push({
        key: itemKey('destination_review', row.id, 'geoPlaceId', null),
        entityType: 'destination_review',
        entityId: row.id,
        fieldPath: 'geoPlaceId',
        position: null,
        sourceLabel: row.city,
        sourceFingerprint: fingerprint(row),
        countryId: row.countryId,
        beforeGeoPlaceId: row.geoPlaceId,
        candidates: [],
        status: 'unresolved',
        reason: 'not_resolved',
        placeId: null,
        decisionSource: null,
        reviewed: false,
      })
    }
  }
  for (const row of metroRows) {
    if (!row.geoPlaceId) {
      pending.push({
        key: itemKey('metro', row.id, 'geoPlaceId', null),
        entityType: 'metro',
        entityId: row.id,
        fieldPath: 'geoPlaceId',
        position: null,
        sourceLabel: row.city,
        sourceFingerprint: fingerprint(row),
        countryCode: await getMetroCountryCode(row.country),
        beforeGeoPlaceId: row.geoPlaceId,
        candidates: [],
        status: 'unresolved',
        reason: 'not_resolved',
        placeId: null,
        decisionSource: null,
        reviewed: false,
      })
    }
  }
  for (const section of sections) {
    const content = section.content
    const bookings = content && typeof content === 'object' && !Array.isArray(content) && Array.isArray(content.bookings) ? content.bookings : []
    for (const [bookingIndex, booking] of bookings.entries()) {
      if (booking?.type !== 'flight' || !Array.isArray(booking?.data?.segments))
        continue
      for (const [segmentIndex, segment] of booking.data.segments.entries()) {
        for (const [cityField, idField] of [['departureCity', 'departureCityId'], ['arrivalCity', 'arrivalCityId']] as const) {
          const label = typeof segment?.[cityField] === 'string' ? segment[cityField].trim() : ''
          if (!label || segment?.[idField])
            continue
          const pathParts: Array<string | number> = ['bookings', bookingIndex, 'data', 'segments', segmentIndex, idField]
          pending.push({
            key: itemKey('flight', section.id, pathParts.join('.'), segmentIndex),
            entityType: 'flight',
            entityId: section.id,
            fieldPath: `content.${pathParts.join('.')}`,
            position: segmentIndex,
            sourceLabel: label,
            sourceFingerprint: fingerprint(section),
            beforeCityId: segment[idField] ?? null,
            beforeCityIdPresent: Object.hasOwn(segment, idField),
            candidates: [],
            status: 'unresolved',
            reason: 'country_or_region_context_required',
            placeId: null,
            decisionSource: null,
            reviewed: false,
            pathParts,
          })
        }
      }
    }
  }

  const resolutionCache = new Map<string, Promise<MigrationItem>>()
  const decisions = await Promise.all(pending.map(async (item) => {
    const cacheKey = [normalizeName(item.sourceLabel), item.countryId ?? '', item.countryCode ?? ''].join('|')
    let cached = resolutionCache.get(cacheKey)
    if (!cached) {
      cached = makeDecision({ ...item }, catalogReady)
      resolutionCache.set(cacheKey, cached)
    }
    const decision = await cached
    return {
      ...item,
      candidates: decision.candidates,
      status: decision.status,
      reason: decision.reason,
      placeId: decision.placeId,
      decisionSource: decision.decisionSource,
    }
  }))
  return decisions
}

function parseArgs(argv: string[]) {
  const [command = 'help', ...rest] = argv
  const flags = new Map<string, string | true>()
  for (let index = 0; index < rest.length; index++) {
    const value = rest[index]!
    if (!value.startsWith('--'))
      throw new Error(`Неизвестный аргумент: ${value}`)
    const next = rest[index + 1]
    if (next && !next.startsWith('--')) {
      flags.set(value, next)
      index++
    }
    else {
      flags.set(value, true)
    }
  }
  return { command, flags }
}

function requiredFlag(flags: Map<string, string | true>, name: string): string {
  const value = flags.get(name)
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Требуется ${name}`)
  return value
}

async function getCatalogVersion(): Promise<string | null> {
  const [version] = await db.select({ id: geoCatalogVersions.id })
    .from(geoCatalogVersions)
    .where(eq(geoCatalogVersions.state, 'ready'))
    .orderBy(desc(geoCatalogVersions.publishedAt))
    .limit(1)
  return version?.id ?? null
}

async function getWeatherCacheStats() {
  const rows = await db.select({ cityNormalized: cityWeatherCache.cityNormalized }).from(cityWeatherCache)
  return { rows: rows.length, distinctCities: new Set(rows.map(row => row.cityNormalized)).size }
}

async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  const absolutePath = path.resolve(filePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 })
  await fs.writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await fs.chmod(absolutePath, 0o600)
}

async function createManifest(outputPath: string): Promise<void> {
  const catalogVersion = await getCatalogVersion()
  const decisions = await collectMigrationItems(Boolean(catalogVersion))
  const manifest: MigrationManifest = {
    format: 'trip-scheduler-geo-backfill',
    version: 1,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    catalogVersion,
    weatherCache: await getWeatherCacheStats(),
    decisions,
  }
  await writePrivateJson(outputPath, manifest)
  const counts = decisions.reduce<Record<string, number>>((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1
    if (item.placeId)
      result.suggestedResolved = (result.suggestedResolved ?? 0) + 1
    return result
  }, {})
  console.info(JSON.stringify({
    runId: manifest.runId,
    catalogVersion,
    items: decisions.length,
    counts,
    legacyWeatherCache: manifest.weatherCache,
    reportPath: path.resolve(outputPath),
    note: 'Отчёт содержит исходные подписи. Храните его вне репозитория и передайте в review до apply.',
  }, null, 2))
}

function assertManifest(value: any): asserts value is MigrationManifest {
  if (!value || value.format !== 'trip-scheduler-geo-backfill' || value.version !== 1 || typeof value.runId !== 'string' || !Array.isArray(value.decisions))
    throw new Error('Неизвестный формат mapping manifest')
}

async function readManifest(filePath: string): Promise<MigrationManifest> {
  const manifest = JSON.parse(await fs.readFile(path.resolve(filePath), 'utf-8'))
  assertManifest(manifest)
  return manifest
}

async function readCurrentItem(tx: any, item: MigrationItem): Promise<{ snapshot: any, row: any, link?: any }> {
  switch (item.entityType) {
    case 'trip': {
      const [trip] = await tx.select().from(trips).where(eq(trips.id, item.entityId)).for('update')
      if (!trip)
        throw new Error(`Trip ${item.entityId} удалён после audit`)
      const [link] = await tx.select().from(tripGeoPlaces).where(and(eq(tripGeoPlaces.tripId, item.entityId), eq(tripGeoPlaces.position, item.position!))).for('update')
      return { snapshot: tripSourceSnapshot(trip, link ?? null), row: trip, link: link ?? null }
    }
    case 'highlight': {
      const [row] = await tx.select().from(highlights).where(eq(highlights.id, item.entityId)).for('update')
      if (!row)
        throw new Error(`Highlight ${item.entityId} удалён после audit`)
      return { snapshot: row, row }
    }
    case 'destination_review': {
      const [row] = await tx.select().from(destinationReviews).where(eq(destinationReviews.id, item.entityId)).for('update')
      if (!row)
        throw new Error(`Destination review ${item.entityId} удалён после audit`)
      return { snapshot: row, row }
    }
    case 'metro': {
      const [row] = await tx.select().from(metroSystems).where(eq(metroSystems.id, item.entityId)).for('update')
      if (!row)
        throw new Error(`Metro system ${item.entityId} удалена после audit`)
      return { snapshot: row, row }
    }
    case 'flight': {
      const [row] = await tx.select().from(tripSections).where(eq(tripSections.id, item.entityId)).for('update')
      if (!row)
        throw new Error(`Flight section ${item.entityId} удалена после audit`)
      return { snapshot: row, row }
    }
  }
}

async function currentEntityFingerprint(tx: any, entityType: EntityType, entityId: string): Promise<string> {
  if (entityType === 'trip') {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, entityId))
    const links = await tx.select().from(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, entityId)).orderBy(asc(tripGeoPlaces.position))
    return fingerprint({ trip, links })
  }
  if (entityType === 'highlight') {
    const [row] = await tx.select().from(highlights).where(eq(highlights.id, entityId))
    return fingerprint(row)
  }
  if (entityType === 'destination_review') {
    const [row] = await tx.select().from(destinationReviews).where(eq(destinationReviews.id, entityId))
    return fingerprint(row)
  }
  if (entityType === 'metro') {
    const [row] = await tx.select().from(metroSystems).where(eq(metroSystems.id, entityId))
    return fingerprint(row)
  }
  const [row] = await tx.select().from(tripSections).where(eq(tripSections.id, entityId))
  return fingerprint(row)
}

async function lockEntity(tx: any, entityType: EntityType, entityId: string): Promise<void> {
  if (entityType === 'trip') {
    await tx.select({ id: trips.id }).from(trips).where(eq(trips.id, entityId)).for('update')
    await tx.select({ position: tripGeoPlaces.position }).from(tripGeoPlaces).where(eq(tripGeoPlaces.tripId, entityId)).for('update')
  }
  else if (entityType === 'highlight') {
    await tx.select({ id: highlights.id }).from(highlights).where(eq(highlights.id, entityId)).for('update')
  }
  else if (entityType === 'destination_review') {
    await tx.select({ id: destinationReviews.id }).from(destinationReviews).where(eq(destinationReviews.id, entityId)).for('update')
  }
  else if (entityType === 'metro') {
    await tx.select({ id: metroSystems.id }).from(metroSystems).where(eq(metroSystems.id, entityId)).for('update')
  }
  else {
    await tx.select({ id: tripSections.id }).from(tripSections).where(eq(tripSections.id, entityId)).for('update')
  }
}

async function validateManifestDecisions(manifest: MigrationManifest): Promise<MigrationItem[]> {
  const catalogVersion = await getCatalogVersion()
  if (!catalogVersion || manifest.catalogVersion !== catalogVersion)
    throw new Error('Каталог изменился после audit; создайте новый audit')
  const currentItems = await collectMigrationItems(Boolean(catalogVersion))
  const currentByKey = new Map(currentItems.map(item => [item.key, item]))
  if (currentByKey.size !== manifest.decisions.length)
    throw new Error('Список source rows изменился после audit; создайте новый audit')
  const seen = new Set<string>()
  const validated: MigrationItem[] = []

  for (const decision of manifest.decisions) {
    if (seen.has(decision.key))
      throw new Error(`Дубликат mapping key: ${decision.key}`)
    seen.add(decision.key)
    const current = currentByKey.get(decision.key)
    if (!current || current.sourceFingerprint !== decision.sourceFingerprint)
      throw new Error(`Запись изменилась после audit: ${decision.key}`)
    const selectedId = decision.placeId ?? null
    if (selectedId) {
      const safeAutoId = current.placeId
      const isSafeAuto = decision.decisionSource === 'exact_preferred_in_country' && selectedId === safeAutoId
      if (decision.decisionSource === 'exact_preferred_in_country' && !isSafeAuto)
        throw new Error(`Safe-auto mapping для ${decision.key} изменён после audit`)
      if (!isSafeAuto && (!decision.reviewed || !decision.reviewedBy?.trim() || !decision.note?.trim()))
        throw new Error(`Ручное сопоставление ${decision.key} требует reviewed=true, reviewedBy и note`)
      const [place] = await geoRepository.getByIds({ ids: [selectedId], locale: 'ru' })
      if (!place || place.retired)
        throw new Error(`Выбранный place ID отсутствует или retired: ${selectedId}`)
      if (['highlight', 'destination_review', 'metro', 'flight'].includes(decision.entityType) && place.kind !== 'settlement')
        throw new Error(`${decision.entityType} допускает только settlement`)
      if (isSafeAuto) {
        // Авто-резолв обязан сохранять согласованность страны. Ручной review, наоборот,
        // может исправить ошибочно приписанную страну (например, «Гонконг» со страной Китай),
        // поэтому для ручного маппинга проверку страны не применяем — страна записи будет
        // приведена к стране выбранного места при apply.
        if (decision.countryId && place.countryId !== decision.countryId)
          throw new Error(`${decision.key}: страна выбранного места не совпадает с countryId записи`)
        if (decision.countryCode && place.countryCode !== decision.countryCode)
          throw new Error(`${decision.key}: страна выбранного места не совпадает с countryCode контекста`)
      }
      current.placeId = selectedId
      current.chosenPlaceCountryId = place.countryId
      current.status = 'resolved'
      current.reason = decision.decisionSource === 'exact_preferred_in_country' ? decision.reason : 'reviewed_mapping'
      current.decisionSource = decision.decisionSource === 'exact_preferred_in_country' ? decision.decisionSource : 'reviewed_mapping'
      current.reviewed = decision.reviewed === true
      current.reviewedBy = decision.reviewedBy
      current.note = decision.note
    }
    else {
      current.placeId = null
      current.status = current.candidates.length > 0 ? 'needs_review' : 'unresolved'
      current.reason = decision.reason || current.reason
      current.decisionSource = null
      current.reviewed = decision.reviewed === true
      current.reviewedBy = decision.reviewedBy
      current.note = decision.note
    }
    validated.push(current)
  }
  return validated
}

async function applyManifest(manifest: MigrationManifest, shouldApply: boolean): Promise<void> {
  const existingRun = await db.select({ id: geoResolutionAudit.id })
    .from(geoResolutionAudit)
    .where(eq(geoResolutionAudit.migrationRunId, manifest.runId))
    .limit(1)
  if (existingRun.length > 0) {
    console.info(`Run ${manifest.runId} уже есть в audit. Повторное применение — no-op.`)
    return
  }
  const decisions = await validateManifestDecisions(manifest)

  const summary = decisions.reduce((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1
    if (item.entityType === 'trip')
      result.tripLinks = (result.tripLinks ?? 0) + 1
    if (item.placeId)
      result.selected = (result.selected ?? 0) + 1
    return result
  }, {} as Record<string, number>)
  console.info(JSON.stringify({ runId: manifest.runId, mode: shouldApply ? 'apply' : 'dry-run', summary }, null, 2))
  if (!shouldApply)
    return

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw('SELECT pg_advisory_xact_lock(hashtext(\'trip-scheduler-geo-backfill\'))'))
    const repeatedRun = await tx.select({ id: geoResolutionAudit.id })
      .from(geoResolutionAudit)
      .where(eq(geoResolutionAudit.migrationRunId, manifest.runId))
      .limit(1)
    if (repeatedRun.length > 0)
      throw new Error(`Run ${manifest.runId} уже применён`)

    const locked = new Map<string, { row: any, link?: any }>()
    for (const item of decisions) {
      const current = await readCurrentItem(tx, item)
      if (fingerprint(current.snapshot) !== item.sourceFingerprint)
        throw new Error(`Conflict: исходная запись изменилась, apply полностью отменён (${item.key})`)
      locked.set(item.key, { row: current.row, link: current.link })
    }

    const flightContentById = new Map<string, any>()
    const flightRowById = new Map<string, any>()
    for (const item of decisions) {
      const before = locked.get(item.key)!
      if (item.entityType === 'trip') {
        const status = item.placeId ? 'resolved' : item.status
        await tx.insert(tripGeoPlaces).values({
          tripId: item.entityId,
          position: item.position!,
          placeId: item.placeId,
          legacyLabel: item.sourceLabel,
          status,
        }).onConflictDoUpdate({
          target: [tripGeoPlaces.tripId, tripGeoPlaces.position],
          set: { placeId: item.placeId, legacyLabel: item.sourceLabel, status, updatedAt: new Date() },
        })
      }
      else if (item.placeId && item.entityType === 'highlight') {
        await tx.update(highlights).set({
          geoPlaceId: item.placeId,
          ...(item.chosenPlaceCountryId ? { countryId: item.chosenPlaceCountryId } : {}),
        }).where(eq(highlights.id, item.entityId))
      }
      else if (item.placeId && item.entityType === 'destination_review') {
        await tx.update(destinationReviews).set({
          geoPlaceId: item.placeId,
          ...(item.chosenPlaceCountryId ? { countryId: item.chosenPlaceCountryId } : {}),
          updatedAt: new Date(),
        }).where(eq(destinationReviews.id, item.entityId))
      }
      else if (item.placeId && item.entityType === 'metro') {
        await tx.update(metroSystems).set({ geoPlaceId: item.placeId }).where(eq(metroSystems.id, item.entityId))
      }
      else if (item.placeId && item.entityType === 'flight') {
        const content = flightContentById.get(item.entityId) ?? JSON.parse(JSON.stringify(before.row.content ?? {}))
        setAtPath(content, item.pathParts!, item.placeId)
        flightContentById.set(item.entityId, content)
        flightRowById.set(item.entityId, before.row)
      }
    }
    for (const [sectionId, content] of flightContentById) {
      if (!flightRowById.has(sectionId))
        throw new Error(`Flight section ${sectionId} исчезла во время apply`)
      await tx.update(tripSections).set({ content, updatedAt: new Date() }).where(eq(tripSections.id, sectionId))
    }

    const afterFingerprints = new Map<string, string>()
    for (const item of decisions) {
      const identity = `${item.entityType}|${item.entityId}`
      if (!afterFingerprints.has(identity))
        afterFingerprints.set(identity, await currentEntityFingerprint(tx, item.entityType, item.entityId))
    }
    const auditRows = decisions.map((item) => {
      const previous = locked.get(item.key)!
      const isApplied = item.entityType === 'trip' || Boolean(item.placeId)
      return {
        migrationRunId: manifest.runId,
        entityType: item.entityType,
        entityId: item.entityId,
        fieldPath: item.fieldPath,
        position: item.position,
        sourceLabel: item.sourceLabel,
        context: {
          countryId: item.countryId ?? null,
          countryCode: item.countryCode ?? null,
          beforeLink: item.entityType === 'trip' ? previous.link ?? null : undefined,
          beforeGeoPlaceId: item.entityType === 'trip' ? undefined : previous.row.geoPlaceId ?? null,
          beforeCountryId: item.entityType === 'highlight' || item.entityType === 'destination_review' ? item.countryId ?? null : undefined,
          afterCountryId: item.entityType === 'highlight' || item.entityType === 'destination_review' ? item.chosenPlaceCountryId ?? null : undefined,
          beforeCityId: item.entityType === 'flight' ? item.beforeCityId ?? null : undefined,
          beforeCityIdPresent: item.entityType === 'flight' ? item.beforeCityIdPresent === true : undefined,
          afterPlaceId: item.placeId,
          pathParts: item.pathParts,
        },
        status: item.status,
        reason: item.reason,
        candidates: item.candidates,
        chosenPlaceId: item.placeId,
        ruleProvenance: {
          method: item.decisionSource ?? 'no_match',
          manifestKey: item.key,
          reviewed: item.reviewed,
          reviewedBy: item.reviewedBy ?? null,
          note: item.note ?? null,
          applied: isApplied,
          afterFingerprint: afterFingerprints.get(`${item.entityType}|${item.entityId}`),
        },
        beforeFingerprint: item.sourceFingerprint,
      }
    })
    const auditBatchSize = Math.max(1, Math.floor(65_535 / Math.max(1, Object.keys(auditRows[0] ?? {}).length)) - 10)
    for (let offset = 0; offset < auditRows.length; offset += auditBatchSize)
      await tx.insert(geoResolutionAudit).values(auditRows.slice(offset, offset + auditBatchSize))
  })
  console.info(`Run ${manifest.runId} успешно применён одной транзакцией.`)
}

async function showRunStatus(runId?: string): Promise<void> {
  if (runId) {
    const rows = await db.select({
      status: geoResolutionAudit.status,
      provenance: geoResolutionAudit.ruleProvenance,
    }).from(geoResolutionAudit).where(eq(geoResolutionAudit.migrationRunId, runId))
    if (rows.length === 0) {
      console.info(`Run ${runId} не найден`)
      return
    }
    const summary = rows.reduce((result, row) => {
      result[row.status] = (result[row.status] ?? 0) + 1
      const provenance = row.provenance as Record<string, any>
      if (provenance?.applied)
        result.applied = (result.applied ?? 0) + 1
      if (provenance?.rolledBackAt)
        result.rolledBack = (result.rolledBack ?? 0) + 1
      return result
    }, {} as Record<string, number>)
    console.info(JSON.stringify({ runId, items: rows.length, summary }, null, 2))
    return
  }

  const rows = await db.select({
    runId: geoResolutionAudit.migrationRunId,
    status: geoResolutionAudit.status,
    count: sql<number>`count(*)`,
  }).from(geoResolutionAudit).groupBy(geoResolutionAudit.migrationRunId, geoResolutionAudit.status)
  console.info(JSON.stringify(rows, null, 2))
}

async function rollbackRun(runId: string, shouldApply: boolean): Promise<void> {
  const rows = await db.select().from(geoResolutionAudit).where(eq(geoResolutionAudit.migrationRunId, runId))
  if (rows.length === 0)
    throw new Error(`Run ${runId} не найден`)
  const pending = rows.filter((row) => {
    const provenance = row.ruleProvenance as Record<string, any>
    return provenance?.applied === true && !provenance?.rolledBackAt
  })
  if (pending.length === 0) {
    console.info(`В run ${runId} нет незавершённых обратимых изменений.`)
    return
  }

  const grouped = new Map<string, typeof pending>()
  for (const row of pending) {
    const key = `${row.entityType}|${row.entityId}`
    const items = grouped.get(key) ?? []
    items.push(row)
    grouped.set(key, items)
  }
  const conflicts: string[] = []
  for (const [key, items] of grouped) {
    const first = items[0]!
    const entityType = first.entityType as EntityType
    const expected = (first.ruleProvenance as Record<string, any>).afterFingerprint
    const current = await currentEntityFingerprint(db, entityType, first.entityId)
    if (!expected || current !== expected)
      conflicts.push(key)
  }

  if (!shouldApply) {
    console.info(JSON.stringify({
      runId,
      mode: 'dry-run',
      reversibleItems: pending.length,
      entities: grouped.size,
      conflicts,
      wouldRollback: conflicts.length === 0,
    }, null, 2))
    return
  }
  if (conflicts.length > 0)
    throw new Error(`Rollback отменён: после apply изменились записи: ${conflicts.join(', ')}`)

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw('SELECT pg_advisory_xact_lock(hashtext(\'trip-scheduler-geo-backfill\'))'))
    for (const [key, items] of grouped) {
      const first = items[0]!
      const entityType = first.entityType as EntityType
      const expected = (first.ruleProvenance as Record<string, any>).afterFingerprint
      await lockEntity(tx, entityType, first.entityId)
      if (await currentEntityFingerprint(tx, entityType, first.entityId) !== expected)
        throw new Error(`Rollback conflict; транзакция отменена для ${key}`)

      if (entityType === 'trip') {
        for (const row of items) {
          const context = row.context as Record<string, any>
          const previousLink = context.beforeLink
          const position = row.position!
          if (!previousLink) {
            await tx.delete(tripGeoPlaces).where(and(eq(tripGeoPlaces.tripId, row.entityId), eq(tripGeoPlaces.position, position)))
            continue
          }
          const restored = {
            ...previousLink,
            createdAt: previousLink.createdAt ? new Date(previousLink.createdAt) : new Date(),
            updatedAt: previousLink.updatedAt ? new Date(previousLink.updatedAt) : new Date(),
          }
          await tx.insert(tripGeoPlaces).values(restored).onConflictDoUpdate({
            target: [tripGeoPlaces.tripId, tripGeoPlaces.position],
            set: {
              placeId: restored.placeId,
              legacyLabel: restored.legacyLabel,
              status: restored.status,
              createdAt: restored.createdAt,
              updatedAt: restored.updatedAt,
            },
          })
        }
      }
      else if (entityType === 'highlight') {
        const context = items[0]!.context as Record<string, any>
        const beforePlaceId = context.beforeGeoPlaceId ?? null
        const countryPayload = 'beforeCountryId' in context ? { countryId: context.beforeCountryId ?? null } : {}
        await tx.update(highlights).set({ geoPlaceId: beforePlaceId, ...countryPayload }).where(eq(highlights.id, first.entityId))
      }
      else if (entityType === 'destination_review') {
        const context = items[0]!.context as Record<string, any>
        const beforePlaceId = context.beforeGeoPlaceId ?? null
        const countryPayload = 'beforeCountryId' in context ? { countryId: context.beforeCountryId ?? null } : {}
        await tx.update(destinationReviews).set({ geoPlaceId: beforePlaceId, ...countryPayload, updatedAt: new Date() }).where(eq(destinationReviews.id, first.entityId))
      }
      else if (entityType === 'metro') {
        const beforePlaceId = (items[0]!.context as Record<string, any>).beforeGeoPlaceId ?? null
        await tx.update(metroSystems).set({ geoPlaceId: beforePlaceId }).where(eq(metroSystems.id, first.entityId))
      }
      else {
        const [section] = await tx.select().from(tripSections).where(eq(tripSections.id, first.entityId)).for('update')
        if (!section)
          throw new Error(`Flight section удалена: ${first.entityId}`)
        const content = JSON.parse(JSON.stringify(section.content ?? {}))
        for (const row of items) {
          const context = row.context as Record<string, any>
          const pathParts = context.pathParts as Array<string | number>
          if (context.beforeCityIdPresent)
            setAtPath(content, pathParts, context.beforeCityId)
          else
            unsetAtPath(content, pathParts)
        }
        await tx.update(tripSections).set({ content, updatedAt: new Date() }).where(eq(tripSections.id, first.entityId))
      }
    }

    const rolledBackAt = new Date().toISOString()
    for (const row of pending) {
      const provenance = row.ruleProvenance as Record<string, any>
      await tx.update(geoResolutionAudit)
        .set({ ruleProvenance: { ...provenance, rolledBackAt } })
        .where(eq(geoResolutionAudit.id, row.id))
    }
  })
  console.info(`Run ${runId} отменён: ${pending.length} audit entries.`)
}

function printHelp(): void {
  console.info([
    'geo backfill commands:',
    '  audit --output <private-report.json>',
    '  apply --mapping <report.json> [--apply]',
    '  status [--run-id <runId>]',
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
    const manifest = await readManifest(requiredFlag(flags, '--mapping'))
    await applyManifest(manifest, flags.get('--apply') === true)
  }
  else if (command === 'status') {
    const runId = flags.get('--run-id')
    await showRunStatus(typeof runId === 'string' ? runId : undefined)
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
    console.error('Geo backfill failed:', error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
