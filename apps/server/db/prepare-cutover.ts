/* eslint-disable no-console */
import type { CityWeatherData } from './schema.type'
import type { GeoPlaceRef, TripCityRef } from '~/modules/geo/geo.schemas'
import { createHash, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { geoNamesPlaceId } from '../src/modules/geo/geo-id'
import { geoRepository } from '../src/repositories/geo.repository'
import { db, pool } from './index'
import {
  countries,
  destinationReviews,
  geoCatalogCountries,
  geoCatalogVersions,
  geoPlaceNames,
  geoPlaces,
  geoResolutionAudit,
  geoWeatherCache,
  highlights,
  metroSystems,
  tripGeoPlaces,
  trips,
  tripSections,
} from './schema'

const GEO_WEATHER_GENERATION_VERSION = 'geo-weather-v1'

/**
 * Полный словарь нестандартных русских названий стран из таблицы `countries` (07.country.ts),
 * которые отличаются от `Intl.DisplayNames(['ru'], { type: 'region' })` или официальных форм GeoNames.
 */
const EXPLICIT_COUNTRY_CODE_BY_RU_NAME: Record<string, string> = {
  'аландские острова': 'AX',
  'американские виргинские острова': 'VI',
  'бермуды': 'BM',
  'британские виргинские острова': 'VG',
  'великобритания': 'GB',
  'внешние малые острова сша': 'UM',
  'восточный тимор': 'TL',
  'гонконг': 'HK',
  'др конго': 'CD',
  'каймановы острова': 'KY',
  'карибские нидерланды': 'BQ',
  'киргизия': 'KG',
  'кокосовые килинг острова': 'CC',
  'косово': 'XK',
  'кот д ивуар': 'CI',
  'макао': 'MO',
  'маршалловы острова': 'MH',
  'микронезия': 'FM',
  'молдова': 'MD',
  'мьянма': 'MM',
  'оаэ': 'AE',
  'острова кука': 'CK',
  'острова питкэрн': 'PN',
  'острова святой елены вознесения и тристан да кунья': 'SH',
  'остров буве': 'BV',
  'остров мэн': 'IM',
  'остров норфолк': 'NF',
  'остров рождества': 'CX',
  'остров херд и острова макдональд': 'HM',
  'палестина': 'PS',
  'папуа новая гвинея': 'PG',
  'республика конго': 'CG',
  'северная корея': 'KP',
  'северная македония': 'MK',
  'северные марианские острова': 'MP',
  'сейшелы': 'SC',
  'сен бартельми': 'BL',
  'сен мартен': 'MF',
  'сен пьер и микелон': 'PM',
  'сент винсент и гренадины': 'VC',
  'сент китс и невис': 'KN',
  'сент люсия': 'LC',
  'синт мартен': 'SX',
  'соломоновы острова': 'SB',
  'сша': 'US',
  'теркс и кайкос': 'TC',
  'фарерские острова': 'FO',
  'фолклендские острова': 'FK',
  'французские южные и антарктические территории': 'TF',
  'цар': 'CF',
  'шпицберген и ян майен': 'SJ',
  'эсватини': 'SZ',
  'юар': 'ZA',
  'южная георгия': 'GS',
  'южная корея': 'KR',
  'южный судан': 'SS',
}

interface CuratedAliasSpec {
  sourceId: string
  placeId: string
  language: 'ru' | 'en'
  name: string
  isPreferred: boolean
  demoteOtherPreferredInLocale?: boolean
  note: string
}

const FLIGHT_PLACEHOLDER_LABELS = new Set([
  'пункт назначения',
  'пункт отправления',
  'город прилета',
  'город вылета',
  'destination',
  'origin',
])

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
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

function buildIsoCodeByNormalizedRuName(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [rawName, code] of Object.entries(EXPLICIT_COUNTRY_CODE_BY_RU_NAME)) {
    map.set(normalizeName(rawName), code)
  }

  const ruDisplay = new Intl.DisplayNames(['ru'], { type: 'region' })
  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first) + String.fromCharCode(second)
      try {
        const label = ruDisplay.of(code)
        if (label && label !== code) {
          const norm = normalizeName(label)
          if (norm && !map.has(norm))
            map.set(norm, code)
        }
      }
      catch {
        // Игнорируем невалидные регионы
      }
    }
  }
  return map
}

function getLegacyWeatherKeys(places: TripCityRef[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const place of places) {
    const key = normalizeName(place.name)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const labels = new Map<string, string>()
  const used = new Set<string>()
  for (const place of places) {
    const duplicateName = (counts.get(normalizeName(place.name)) ?? 0) > 1
    const context = duplicateName ? [place.regionName, place.countryName].filter(Boolean).join(', ') : ''
    let label = context ? `${place.name} — ${context}` : place.name
    if (used.has(normalizeName(label)))
      label = `${label} (${place.countryCode})`
    if (used.has(normalizeName(label)))
      label = `${label} [${place.id.slice(0, 8)}]`
    used.add(normalizeName(label))
    labels.set(place.id, label)
  }
  return labels
}

function getGeoWeatherFingerprint(place: GeoPlaceRef, month: number): string {
  const input = JSON.stringify({
    placeId: place.id,
    name: place.name,
    countryCode: place.countryCode,
    countryName: place.countryName,
    regionName: place.regionName,
    latitude: place.latitude,
    longitude: place.longitude,
    month,
    generationVersion: GEO_WEATHER_GENERATION_VERSION,
  })

  return createHash('sha256').update(input).digest('hex')
}

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  const gubeiArg = argv.find(arg => arg.startsWith('--gubei='))?.split('=')[1]?.toLowerCase()
  if (gubeiArg && gubeiArg !== 'gubeikou' && gubeiArg !== 'beijing') {
    throw new Error('Флаг --gubei поддерживает только значения "gubeikou" (по умолчанию) или "beijing"')
  }
  const gubeiMode: 'gubeikou' | 'beijing' = gubeiArg === 'beijing' ? 'beijing' : 'gubeikou'
  const help = argv.includes('--help') || argv.includes('-h')
  return { apply, gubeiMode, help }
}

async function main() {
  const { apply, gubeiMode, help } = parseArgs(process.argv.slice(2))
  if (help) {
    console.info([
      'Использование:',
      '  bun run geo:prepare-cutover [--gubei=gubeikou|beijing] [--apply]',
      '',
      'По умолчанию работает в режиме dry-run (без записи в БД).',
      'С флагом --apply выполняет все изменения в одной транзакции.',
    ].join('\n'))
    return
  }

  const runId = `prepare-cutover-${randomUUID()}`

  const [readyVersion] = await db.select({ id: geoCatalogVersions.id })
    .from(geoCatalogVersions)
    .where(eq(geoCatalogVersions.state, 'ready'))
    .orderBy(desc(geoCatalogVersions.publishedAt))
    .limit(1)

  if (!readyVersion) {
    throw new Error('В geo_catalog_versions нет опубликованного каталога (state = ready). Сначала выполните bun run geo:import --apply.')
  }
  const catalogVersion = readyVersion.id

  // ---------------------------------------------------------------------------
  // 1. Сбор и планирование связей стран (countries <-> geo_catalog_countries)
  // ---------------------------------------------------------------------------
  const [legacyCountryRows, catalogCountryRows] = await Promise.all([
    db.select().from(countries),
    db.select().from(geoCatalogCountries),
  ])

  const isoByNormRu = buildIsoCodeByNormalizedRuName()

  // Также учитываем имена из самой geo_catalog_countries
  for (const cat of catalogCountryRows) {
    for (const candidateName of [cat.nameRu, cat.sourceName, cat.asciiName]) {
      if (!candidateName)
        continue
      const norm = normalizeName(candidateName)
      if (norm && !isoByNormRu.has(norm))
        isoByNormRu.set(norm, cat.code.toUpperCase())
    }
  }

  const usedSourceCodes = new Set(
    legacyCountryRows.map(r => r.sourceCode?.toUpperCase()).filter((c): c is string => Boolean(c)),
  )
  const legacyIdByCode = new Map<string, string>()
  const legacyNameByCode = new Map<string, string>()
  for (const row of legacyCountryRows) {
    if (row.sourceCode) {
      const code = row.sourceCode.toUpperCase()
      legacyIdByCode.set(code, row.id)
      legacyNameByCode.set(code, row.name)
    }
  }

  const countrySourceCodeUpdates: Array<{ id: string, name: string, sourceCode: string }> = []
  for (const row of legacyCountryRows) {
    if (row.sourceCode)
      continue
    const norm = normalizeName(row.name)
    const inferredCode = isoByNormRu.get(norm)
    if (inferredCode && !usedSourceCodes.has(inferredCode)) {
      usedSourceCodes.add(inferredCode)
      legacyIdByCode.set(inferredCode, row.id)
      legacyNameByCode.set(inferredCode, row.name)
      countrySourceCodeUpdates.push({
        id: row.id,
        name: row.name,
        sourceCode: inferredCode,
      })
    }
  }

  const catalogCountryUpdates: Array<{
    code: string
    sourceName: string
    beforeLegacyCountryId: string | null
    afterLegacyCountryId: string
    beforeNameRu: string | null
    afterNameRu: string | null
  }> = []

  for (const cat of catalogCountryRows) {
    const code = cat.code.toUpperCase()
    const targetLegacyId = legacyIdByCode.get(code)
    if (!targetLegacyId)
      continue
    const targetNameRu = cat.nameRu || legacyNameByCode.get(code) || null
    if (cat.legacyCountryId !== targetLegacyId || (!cat.nameRu && targetNameRu)) {
      catalogCountryUpdates.push({
        code,
        sourceName: cat.sourceName,
        beforeLegacyCountryId: cat.legacyCountryId,
        afterLegacyCountryId: targetLegacyId,
        beforeNameRu: cat.nameRu,
        afterNameRu: targetNameRu,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Проверка целевых мест в geo_places и планирование app_override алиасов
  // ---------------------------------------------------------------------------
  const gubeikouPlaceId = geoNamesPlaceId('2037173')
  const beijingPlaceId = geoNamesPlaceId('1816670')
  const shenzhenPlaceId = geoNamesPlaceId('1795565')
  const fenghuangPlaceId = geoNamesPlaceId('7304020')
  const tokyoPlaceId = geoNamesPlaceId('1850147')
  const osakaPlaceId = geoNamesPlaceId('1853909')

  const keyPlaceIds = [
    gubeikouPlaceId,
    beijingPlaceId,
    shenzhenPlaceId,
    fenghuangPlaceId,
    tokyoPlaceId,
    osakaPlaceId,
  ]

  const existingKeyPlaces = await db.select().from(geoPlaces).where(inArray(geoPlaces.id, keyPlaceIds))
  const existingKeyPlaceById = new Map(existingKeyPlaces.map(p => [p.id, p]))

  const hasGubeikouInCatalog = existingKeyPlaceById.has(gubeikouPlaceId)
  const chosenGubeiPlaceId = gubeiMode === 'beijing' || !hasGubeikouInCatalog
    ? beijingPlaceId
    : gubeikouPlaceId
  const chosenGubeiDisplayName = chosenGubeiPlaceId === gubeikouPlaceId ? 'Губэй' : 'Пекин'

  const allCuratedAliases: CuratedAliasSpec[] = [
    ...(chosenGubeiPlaceId === gubeikouPlaceId
      ? [{
          sourceId: '2037173',
          placeId: gubeikouPlaceId,
          language: 'ru' as const,
          name: 'Губэй',
          isPreferred: true,
          demoteOtherPreferredInLocale: true,
          note: 'Водный городок Губэй (Gubeikou, район Миюнь, Пекин)',
        }]
      : []),
    {
      sourceId: '7304020',
      placeId: fenghuangPlaceId,
      language: 'ru',
      name: 'Фэнхуан',
      isPreferred: true,
      demoteOtherPreferredInLocale: true,
      note: 'Русское название для Fenghuang (провинция Хунань, КНР)',
    },
    {
      sourceId: '1795565',
      placeId: shenzhenPlaceId,
      language: 'ru',
      name: 'Шеньчжень',
      isPreferred: false,
      demoteOtherPreferredInLocale: false,
      note: 'Альтернативное написание Шэньчжэня через «е» для поиска',
    },
  ]
  const curatedAliases = allCuratedAliases.filter(spec => existingKeyPlaceById.has(spec.placeId))

  // ---------------------------------------------------------------------------
  // 3. Планирование разрешения 35 неразрешённых городов (highlights, reviews, metro, flights)
  // ---------------------------------------------------------------------------
  const curatedCityRuleByNormalizedLabel = new Map<string, {
    placeId: string
    canonicalCityName: string
    preserveLabelInAddressIfDifferent?: boolean
    note: string
  }>([
    [normalizeName('Губэй'), {
      placeId: chosenGubeiPlaceId,
      canonicalCityName: chosenGubeiDisplayName,
      preserveLabelInAddressIfDifferent: chosenGubeiPlaceId === beijingPlaceId,
      note: chosenGubeiPlaceId === gubeikouPlaceId
        ? 'Губэй под Пекином -> Gubeikou (2037173, Beijing)'
        : 'Губэй под Пекином -> Пекин (1816670)',
    }],
    [normalizeName('Шеньчжень'), {
      placeId: shenzhenPlaceId,
      canonicalCityName: 'Шэньчжэнь',
      note: 'Шеньчжень -> Шэньчжэнь (1795565)',
    }],
    [normalizeName('Фэнхуан'), {
      placeId: fenghuangPlaceId,
      canonicalCityName: 'Фэнхуан',
      note: 'Фэнхуан -> Fenghuang, Hunan (7304020)',
    }],
    [normalizeName('Tokyo Narita'), {
      placeId: tokyoPlaceId,
      canonicalCityName: 'Токио',
      note: 'Аэропорт Tokyo Narita -> Токио (1850147)',
    }],
    [normalizeName('Narita'), {
      placeId: tokyoPlaceId,
      canonicalCityName: 'Токио',
      note: 'Narita -> Токио (1850147)',
    }],
    [normalizeName('Kansai'), {
      placeId: osakaPlaceId,
      canonicalCityName: 'Осака',
      note: 'Аэропорт Kansai -> Осака (1853909)',
    }],
    [normalizeName('Osaka Kansai'), {
      placeId: osakaPlaceId,
      canonicalCityName: 'Осака',
      note: 'Osaka Kansai -> Осака (1853909)',
    }],
  ])

  const [unresolvedHighlights, unresolvedReviews, unresolvedMetros, bookingSections] = await Promise.all([
    db.select().from(highlights).where(isNull(highlights.geoPlaceId)),
    db.select().from(destinationReviews).where(and(eq(destinationReviews.type, 'city'), isNull(destinationReviews.geoPlaceId))),
    db.select().from(metroSystems).where(isNull(metroSystems.geoPlaceId)),
    db.select().from(tripSections).where(eq(tripSections.type, 'bookings')),
  ])

  // Карта code -> countryId с учетом планируемых обновлений
  const effectiveLegacyCountryIdByCode = new Map<string, string>()
  for (const cat of catalogCountryRows) {
    const code = cat.code.toUpperCase()
    const id = cat.legacyCountryId ?? legacyIdByCode.get(code)
    if (id)
      effectiveLegacyCountryIdByCode.set(code, id)
  }
  const effectiveCodeByLegacyCountryId = new Map<string, string>()
  for (const [code, id] of effectiveLegacyCountryIdByCode) {
    effectiveCodeByLegacyCountryId.set(id, code)
  }

  async function resolveLabelWithEffectiveCatalog(label: string, legacyCountryId?: string | null): Promise<{
    placeId: string
    canonicalCityName: string
    countryId: string | null
    note: string
    preserveLabelInAddressIfDifferent?: boolean
  } | null> {
    const norm = normalizeName(label)
    if (!norm)
      return null

    const curated = curatedCityRuleByNormalizedLabel.get(norm)
    if (curated && existingKeyPlaceById.has(curated.placeId)) {
      const place = existingKeyPlaceById.get(curated.placeId)!
      return {
        placeId: curated.placeId,
        canonicalCityName: curated.canonicalCityName,
        countryId: effectiveLegacyCountryIdByCode.get(place.countryCode) ?? legacyCountryId ?? null,
        note: curated.note,
        preserveLabelInAddressIfDifferent: curated.preserveLabelInAddressIfDifferent,
      }
    }

    const countryCode = legacyCountryId ? effectiveCodeByLegacyCountryId.get(legacyCountryId) : undefined
    const exact = await geoRepository.resolveExact({
      label,
      ...(countryCode ? { countryCode } : {}),
      kinds: ['settlement'],
    })
    if (exact.status === 'resolved' && exact.place) {
      return {
        placeId: exact.place.id,
        canonicalCityName: exact.place.name,
        countryId: effectiveLegacyCountryIdByCode.get(exact.place.countryCode) ?? exact.place.countryId ?? legacyCountryId ?? null,
        note: `Авто-резолв по точному имени (${exact.reason})`,
      }
    }
    return null
  }

  const plannedHighlightUpdates: Array<{
    id: string
    beforeCity: string
    afterCity: string
    beforeCountryId: string
    afterCountryId: string
    beforeAddress: string | null
    afterAddress: string | null
    placeId: string
    note: string
    beforeFingerprint: string
    rowSnapshot: typeof highlights.$inferSelect
  }> = []

  const remainingUnresolvedHighlights: Array<{ id: string, city: string, countryId: string }> = []

  for (const row of unresolvedHighlights) {
    const match = await resolveLabelWithEffectiveCatalog(row.city, row.countryId)
    if (!match) {
      remainingUnresolvedHighlights.push({ id: row.id, city: row.city, countryId: row.countryId })
      continue
    }
    let afterAddress = row.address
    if (match.preserveLabelInAddressIfDifferent && normalizeName(row.city) !== normalizeName(match.canonicalCityName)) {
      if (!afterAddress || !afterAddress.trim()) {
        afterAddress = row.city.trim()
      }
      else if (!normalizeName(afterAddress).includes(normalizeName(row.city))) {
        afterAddress = `${row.city.trim()}, ${afterAddress.trim()}`
      }
    }
    plannedHighlightUpdates.push({
      id: row.id,
      beforeCity: row.city,
      afterCity: match.canonicalCityName,
      beforeCountryId: row.countryId,
      afterCountryId: match.countryId ?? row.countryId,
      beforeAddress: row.address,
      afterAddress,
      placeId: match.placeId,
      note: match.note,
      beforeFingerprint: fingerprint(row),
      rowSnapshot: row,
    })
  }

  const plannedReviewUpdates: Array<{
    id: string
    beforeCity: string | null
    afterCity: string
    beforeCountryId: string
    afterCountryId: string
    placeId: string
    note: string
    beforeFingerprint: string
    rowSnapshot: typeof destinationReviews.$inferSelect
  }> = []

  const remainingUnresolvedReviews: Array<{ id: string, city: string | null, countryId: string }> = []

  for (const row of unresolvedReviews) {
    if (!row.city?.trim()) {
      remainingUnresolvedReviews.push({ id: row.id, city: row.city, countryId: row.countryId })
      continue
    }
    const match = await resolveLabelWithEffectiveCatalog(row.city, row.countryId)
    if (!match) {
      remainingUnresolvedReviews.push({ id: row.id, city: row.city, countryId: row.countryId })
      continue
    }
    plannedReviewUpdates.push({
      id: row.id,
      beforeCity: row.city,
      afterCity: match.canonicalCityName,
      beforeCountryId: row.countryId,
      afterCountryId: match.countryId ?? row.countryId,
      placeId: match.placeId,
      note: match.note,
      beforeFingerprint: fingerprint(row),
      rowSnapshot: row,
    })
  }

  const plannedMetroUpdates: Array<{
    id: string
    city: string
    placeId: string
    note: string
    beforeFingerprint: string
    rowSnapshot: typeof metroSystems.$inferSelect
  }> = []

  const remainingUnresolvedMetros: Array<{ id: string, city: string, country: string }> = []

  for (const row of unresolvedMetros) {
    const countryCode = isoByNormRu.get(normalizeName(row.country))
    const legacyCountryId = countryCode ? effectiveLegacyCountryIdByCode.get(countryCode) : null
    const match = await resolveLabelWithEffectiveCatalog(row.city, legacyCountryId)
    if (!match) {
      remainingUnresolvedMetros.push({ id: row.id, city: row.city, country: row.country })
      continue
    }
    plannedMetroUpdates.push({
      id: row.id,
      city: row.city,
      placeId: match.placeId,
      note: match.note,
      beforeFingerprint: fingerprint(row),
      rowSnapshot: row,
    })
  }

  // Сегменты перелетов в trip_sections (type = 'bookings')
  interface PlannedFlightChange {
    sectionId: string
    tripId: string
    bookingIndex: number
    segmentIndex: number
    cityField: 'departureCity' | 'arrivalCity'
    idField: 'departureCityId' | 'arrivalCityId'
    beforeLabel: string
    action: 'resolve' | 'clear_placeholder'
    placeId: string | null
    afterLabel: string
    note: string
  }

  const plannedFlightChanges: PlannedFlightChange[] = []
  const plannedFlightSectionContents = new Map<string, {
    beforeSection: typeof tripSections.$inferSelect
    beforeFingerprint: string
    afterContent: any
  }>()
  const remainingUnresolvedFlights: Array<{
    sectionId: string
    tripId: string
    segmentIndex: number
    field: string
    label: string
  }> = []

  for (const section of bookingSections) {
    const content = section.content
    const bookings = content && typeof content === 'object' && !Array.isArray(content) && Array.isArray(content.bookings)
      ? content.bookings
      : []

    let clonedContent: any | null = null
    for (const [bookingIndex, booking] of bookings.entries()) {
      if (booking?.type !== 'flight' || !Array.isArray(booking?.data?.segments))
        continue
      for (const [segmentIndex, segment] of booking.data.segments.entries()) {
        for (const [cityField, idField] of [['departureCity', 'departureCityId'], ['arrivalCity', 'arrivalCityId']] as const) {
          const label = typeof segment?.[cityField] === 'string' ? segment[cityField].trim() : ''
          if (!label || segment?.[idField])
            continue

          const normLabel = normalizeName(label)
          if (FLIGHT_PLACEHOLDER_LABELS.has(normLabel)) {
            if (!clonedContent)
              clonedContent = JSON.parse(JSON.stringify(section.content ?? {}))
            clonedContent.bookings[bookingIndex].data.segments[segmentIndex][cityField] = ''
            delete clonedContent.bookings[bookingIndex].data.segments[segmentIndex][idField]
            plannedFlightChanges.push({
              sectionId: section.id,
              tripId: section.tripId,
              bookingIndex,
              segmentIndex,
              cityField,
              idField,
              beforeLabel: label,
              action: 'clear_placeholder',
              placeId: null,
              afterLabel: '',
              note: 'Очищена шаблонная заглушка в сегменте перелёта',
            })
            continue
          }

          const match = await resolveLabelWithEffectiveCatalog(label, null)
          if (match) {
            if (!clonedContent)
              clonedContent = JSON.parse(JSON.stringify(section.content ?? {}))
            clonedContent.bookings[bookingIndex].data.segments[segmentIndex][idField] = match.placeId
            clonedContent.bookings[bookingIndex].data.segments[segmentIndex][cityField] = match.canonicalCityName
            plannedFlightChanges.push({
              sectionId: section.id,
              tripId: section.tripId,
              bookingIndex,
              segmentIndex,
              cityField,
              idField,
              beforeLabel: label,
              action: 'resolve',
              placeId: match.placeId,
              afterLabel: match.canonicalCityName,
              note: match.note,
            })
          }
          else {
            remainingUnresolvedFlights.push({
              sectionId: section.id,
              tripId: section.tripId,
              segmentIndex,
              field: cityField,
              label,
            })
          }
        }
      }
    }

    if (clonedContent) {
      plannedFlightSectionContents.set(section.id, {
        beforeSection: section,
        beforeFingerprint: fingerprint(section),
        afterContent: clonedContent,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Планирование переноса погоды trips.weather_data -> trips.weather_by_place_id
  // ---------------------------------------------------------------------------
  const [allTrips, allTripGeoLinks] = await Promise.all([
    db.select().from(trips),
    db.select().from(tripGeoPlaces).orderBy(asc(tripGeoPlaces.tripId), asc(tripGeoPlaces.position)),
  ])

  const linksByTripId = new Map<string, Array<typeof tripGeoPlaces.$inferSelect>>()
  for (const link of allTripGeoLinks) {
    const list = linksByTripId.get(link.tripId) ?? []
    list.push(link)
    linksByTripId.set(link.tripId, list)
  }

  const allResolvedTripPlaceIds = [...new Set(
    allTripGeoLinks
      .filter(l => l.status === 'resolved' && l.placeId)
      .map(l => l.placeId!),
  )]

  const [hydratedTripPlaces, tripPlaceNameRows] = await Promise.all([
    geoRepository.getByIds({ ids: allResolvedTripPlaceIds, locale: 'ru' }),
    allResolvedTripPlaceIds.length > 0
      ? db.select({
          placeId: geoPlaceNames.placeId,
          name: geoPlaceNames.name,
          normalizedName: geoPlaceNames.normalizedName,
        })
          .from(geoPlaceNames)
          .where(inArray(geoPlaceNames.placeId, allResolvedTripPlaceIds))
      : Promise.resolve([]),
  ])

  const hydratedPlaceById = new Map(hydratedTripPlaces.map(p => [p.id, p]))
  const aliasNormsByPlaceId = new Map<string, Set<string>>()
  for (const row of tripPlaceNameRows) {
    const set = aliasNormsByPlaceId.get(row.placeId) ?? new Set<string>()
    set.add(row.normalizedName)
    set.add(normalizeName(row.name))
    aliasNormsByPlaceId.set(row.placeId, set)
  }

  const plannedTripWeatherUpdates: Array<{
    tripId: string
    title: string
    addedPlaceIds: string[]
    matchedKeys: Record<string, string>
    afterWeatherByPlaceId: Record<string, CityWeatherData>
    cacheRowsToSeed: Array<typeof geoWeatherCache.$inferInsert>
  }> = []

  let tripsWithUnmigratedWeatherCount = 0

  for (const trip of allTrips) {
    const weatherData = trip.weatherData && typeof trip.weatherData === 'object'
      ? (trip.weatherData as Record<string, CityWeatherData>)
      : null
    if (!weatherData || Object.keys(weatherData).length === 0)
      continue

    const tripLinks = (linksByTripId.get(trip.id) ?? []).filter(l => l.status === 'resolved' && l.placeId)
    if (tripLinks.length === 0)
      continue

    const cityRefs: TripCityRef[] = tripLinks.flatMap((link) => {
      const place = link.placeId ? hydratedPlaceById.get(link.placeId) : undefined
      return place ? [{ ...place, position: link.position }] : []
    })
    if (cityRefs.length === 0)
      continue

    const legacyKeysByPlaceId = getLegacyWeatherKeys(cityRefs)
    const currentByPlaceId: Record<string, CityWeatherData> = {
      ...(trip.weatherByPlaceId && typeof trip.weatherByPlaceId === 'object' ? trip.weatherByPlaceId : {}),
    }

    const weatherEntriesByNormKey = new Map<string, { rawKey: string, data: CityWeatherData }>()
    for (const [rawKey, data] of Object.entries(weatherData)) {
      if (data && typeof data === 'object') {
        weatherEntriesByNormKey.set(normalizeName(rawKey), { rawKey, data })
      }
    }

    const addedPlaceIds: string[] = []
    const matchedKeys: Record<string, string> = {}
    const cacheRowsToSeed: Array<typeof geoWeatherCache.$inferInsert> = []
    const month = trip.startDate ? new Date(trip.startDate).getMonth() + 1 : new Date().getMonth() + 1

    for (const place of cityRefs) {
      if (currentByPlaceId[place.id])
        continue

      const link = tripLinks.find(l => l.position === place.position)
      const legacyCityAtPos = Array.isArray(trip.cities) ? trip.cities[place.position] : undefined
      const candidateStrings = [
        legacyKeysByPlaceId.get(place.id),
        place.name,
        link?.legacyLabel,
        legacyCityAtPos,
      ].filter((s): s is string => Boolean(s && s.trim()))

      let found: { rawKey: string, data: CityWeatherData } | undefined
      for (const candidate of candidateStrings) {
        const direct = weatherData[candidate]
        if (direct && typeof direct === 'object') {
          found = { rawKey: candidate, data: direct }
          break
        }
        const byNorm = weatherEntriesByNormKey.get(normalizeName(candidate))
        if (byNorm) {
          found = byNorm
          break
        }
      }

      if (!found) {
        const placeAliases = aliasNormsByPlaceId.get(place.id)
        if (placeAliases) {
          for (const [normKey, entry] of weatherEntriesByNormKey) {
            // Сопоставляем как полное имя, так и префикс до тире "Город — Регион"
            const baseNormKey = normalizeName(entry.rawKey.split('—')[0] ?? entry.rawKey)
            if (placeAliases.has(normKey) || (baseNormKey && placeAliases.has(baseNormKey))) {
              found = entry
              break
            }
          }
        }
      }

      if (found) {
        const normalizedWeatherPayload: CityWeatherData = {
          ...found.data,
          city: place.name,
        }
        currentByPlaceId[place.id] = normalizedWeatherPayload
        addedPlaceIds.push(place.id)
        matchedKeys[place.id] = `${found.rawKey} -> ${place.name}`
        cacheRowsToSeed.push({
          placeId: place.id,
          month,
          generationVersion: GEO_WEATHER_GENERATION_VERSION,
          inputFingerprint: getGeoWeatherFingerprint(place, month),
          data: normalizedWeatherPayload,
        })
      }
      else {
        tripsWithUnmigratedWeatherCount++
      }
    }

    if (addedPlaceIds.length > 0) {
      plannedTripWeatherUpdates.push({
        tripId: trip.id,
        title: trip.title,
        addedPlaceIds,
        matchedKeys,
        afterWeatherByPlaceId: currentByPlaceId,
        cacheRowsToSeed,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Применение в транзакции (если передан --apply)
  // ---------------------------------------------------------------------------
  if (apply) {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw('SELECT pg_advisory_xact_lock(hashtext(\'trip-scheduler-geo-prepare-cutover\'))'))

      // 5.1. Обновление countries.source_code
      for (const item of countrySourceCodeUpdates) {
        await tx.update(countries)
          .set({ sourceCode: item.sourceCode })
          .where(and(eq(countries.id, item.id), isNull(countries.sourceCode)))
      }

      // 5.2. Обновление geo_catalog_countries.legacy_country_id и name_ru
      for (const item of catalogCountryUpdates) {
        await tx.update(geoCatalogCountries)
          .set({
            legacyCountryId: item.afterLegacyCountryId,
            ...(item.afterNameRu ? { nameRu: item.afterNameRu } : {}),
            updatedAt: new Date(),
          })
          .where(eq(geoCatalogCountries.code, item.code))
      }

      // 5.3. Запись курируемых app_override алиасов в geo_place_names
      for (const alias of curatedAliases) {
        if (alias.demoteOtherPreferredInLocale) {
          await tx.update(geoPlaceNames)
            .set({ isPreferred: false })
            .where(and(
              eq(geoPlaceNames.placeId, alias.placeId),
              eq(geoPlaceNames.language, alias.language),
            ))
        }
        const normalized = normalizeName(alias.name)
        await tx.insert(geoPlaceNames).values({
          placeId: alias.placeId,
          language: alias.language,
          name: alias.name,
          normalizedName: normalized,
          prefixKey: normalized,
          origin: 'app_override',
          isPreferred: alias.isPreferred,
          isHistorical: false,
          sourceNameId: null,
          catalogVersion,
        }).onConflictDoUpdate({
          target: [geoPlaceNames.placeId, geoPlaceNames.language, geoPlaceNames.normalizedName],
          set: {
            name: alias.name,
            prefixKey: normalized,
            origin: 'app_override',
            isPreferred: alias.isPreferred,
            isHistorical: false,
            catalogVersion,
          },
        })
      }

      // 5.4. Обновление highlights, destination_reviews, metro_systems, trip_sections + запись в geo_resolution_audit
      const auditRows: Array<typeof geoResolutionAudit.$inferInsert> = []

      for (const item of plannedHighlightUpdates) {
        await tx.update(highlights)
          .set({
            geoPlaceId: item.placeId,
            city: item.afterCity,
            countryId: item.afterCountryId,
            address: item.afterAddress,
          })
          .where(eq(highlights.id, item.id))

        auditRows.push({
          migrationRunId: runId,
          entityType: 'highlight',
          entityId: item.id,
          fieldPath: 'geoPlaceId',
          position: null,
          sourceLabel: item.beforeCity,
          context: {
            beforeGeoPlaceId: null,
            beforeCity: item.beforeCity,
            afterCity: item.afterCity,
            beforeCountryId: item.beforeCountryId,
            afterCountryId: item.afterCountryId,
            beforeAddress: item.beforeAddress,
            afterAddress: item.afterAddress,
            afterPlaceId: item.placeId,
          },
          status: 'resolved',
          reason: 'reviewed_mapping',
          candidates: [],
          chosenPlaceId: item.placeId,
          ruleProvenance: {
            method: 'reviewed_mapping',
            reviewed: true,
            reviewedBy: 'geo:prepare-cutover',
            note: item.note,
            applied: true,
          },
          beforeFingerprint: item.beforeFingerprint,
        })
      }

      for (const item of plannedReviewUpdates) {
        await tx.update(destinationReviews)
          .set({
            geoPlaceId: item.placeId,
            city: item.afterCity,
            countryId: item.afterCountryId,
            updatedAt: new Date(),
          })
          .where(eq(destinationReviews.id, item.id))

        auditRows.push({
          migrationRunId: runId,
          entityType: 'destination_review',
          entityId: item.id,
          fieldPath: 'geoPlaceId',
          position: null,
          sourceLabel: item.beforeCity ?? '',
          context: {
            beforeGeoPlaceId: null,
            beforeCity: item.beforeCity,
            afterCity: item.afterCity,
            beforeCountryId: item.beforeCountryId,
            afterCountryId: item.afterCountryId,
            afterPlaceId: item.placeId,
          },
          status: 'resolved',
          reason: 'reviewed_mapping',
          candidates: [],
          chosenPlaceId: item.placeId,
          ruleProvenance: {
            method: 'reviewed_mapping',
            reviewed: true,
            reviewedBy: 'geo:prepare-cutover',
            note: item.note,
            applied: true,
          },
          beforeFingerprint: item.beforeFingerprint,
        })
      }

      for (const item of plannedMetroUpdates) {
        await tx.update(metroSystems)
          .set({ geoPlaceId: item.placeId })
          .where(eq(metroSystems.id, item.id))

        auditRows.push({
          migrationRunId: runId,
          entityType: 'metro',
          entityId: item.id,
          fieldPath: 'geoPlaceId',
          position: null,
          sourceLabel: item.city,
          context: {
            beforeGeoPlaceId: null,
            afterPlaceId: item.placeId,
          },
          status: 'resolved',
          reason: 'reviewed_mapping',
          candidates: [],
          chosenPlaceId: item.placeId,
          ruleProvenance: {
            method: 'reviewed_mapping',
            reviewed: true,
            reviewedBy: 'geo:prepare-cutover',
            note: item.note,
            applied: true,
          },
          beforeFingerprint: item.beforeFingerprint,
        })
      }

      for (const [sectionId, sectionUpdate] of plannedFlightSectionContents) {
        await tx.update(tripSections)
          .set({
            content: sectionUpdate.afterContent,
            updatedAt: new Date(),
          })
          .where(eq(tripSections.id, sectionId))
      }

      for (const change of plannedFlightChanges) {
        const sectionInfo = plannedFlightSectionContents.get(change.sectionId)!
        auditRows.push({
          migrationRunId: runId,
          entityType: 'flight',
          entityId: change.sectionId,
          fieldPath: `content.bookings.${change.bookingIndex}.data.segments.${change.segmentIndex}.${change.idField}`,
          position: change.segmentIndex,
          sourceLabel: change.beforeLabel,
          context: {
            tripId: change.tripId,
            action: change.action,
            beforeLabel: change.beforeLabel,
            afterLabel: change.afterLabel,
            afterPlaceId: change.placeId,
          },
          status: 'resolved',
          reason: change.action === 'clear_placeholder' ? 'placeholder_cleared' : 'reviewed_mapping',
          candidates: [],
          chosenPlaceId: change.placeId,
          ruleProvenance: {
            method: change.action === 'clear_placeholder' ? 'placeholder_cleanup' : 'reviewed_mapping',
            reviewed: true,
            reviewedBy: 'geo:prepare-cutover',
            note: change.note,
            applied: true,
          },
          beforeFingerprint: sectionInfo.beforeFingerprint,
        })
      }

      if (auditRows.length > 0) {
        await tx.insert(geoResolutionAudit).values(auditRows)
      }

      // 5.5. Бэкфилл trips.weather_by_place_id и geo_weather_cache
      for (const item of plannedTripWeatherUpdates) {
        await tx.update(trips)
          .set({
            weatherByPlaceId: item.afterWeatherByPlaceId,
          })
          .where(eq(trips.id, item.tripId))

        if (item.cacheRowsToSeed.length > 0) {
          await tx.insert(geoWeatherCache)
            .values(item.cacheRowsToSeed)
            .onConflictDoNothing()
        }
      }
    })
  }

  // ---------------------------------------------------------------------------
  // 6. Итоговый отчёт о готовности к сносу легаси
  // ---------------------------------------------------------------------------
  const unresolvedTripLinksCount = allTripGeoLinks.filter(l => l.status !== 'resolved' || !l.placeId).length
  const unmappedLegacyCountriesAfter = legacyCountryRows.filter(r => !r.sourceCode).length - countrySourceCodeUpdates.length
  const unmappedCatalogCountriesAfter = catalogCountryRows.filter((cat) => {
    const code = cat.code.toUpperCase()
    return !cat.legacyCountryId && !legacyIdByCode.has(code)
  })

  const readiness = {
    unmappedLegacyCountries: unmappedLegacyCountriesAfter,
    unmappedCatalogCountries: unmappedCatalogCountriesAfter.length,
    unmappedCatalogCountryCodes: unmappedCatalogCountriesAfter.map(c => c.code),
    unresolvedTripLinks: unresolvedTripLinksCount,
    unresolvedHighlights: remainingUnresolvedHighlights.length,
    unresolvedCityReviews: remainingUnresolvedReviews.length,
    unresolvedMetroSystems: remainingUnresolvedMetros.length,
    unresolvedFlightSegments: remainingUnresolvedFlights.length,
    tripsWithUnmigratedWeather: tripsWithUnmigratedWeatherCount,
    readyForLegacyCutover:
      unmappedLegacyCountriesAfter === 0
      && unresolvedTripLinksCount === 0
      && remainingUnresolvedHighlights.length === 0
      && remainingUnresolvedReviews.length === 0
      && remainingUnresolvedMetros.length === 0
      && remainingUnresolvedFlights.length === 0
      && tripsWithUnmigratedWeatherCount === 0,
  }

  console.info(JSON.stringify({
    runId,
    mode: apply ? 'applied' : 'dry-run',
    catalogVersion,
    gubeiResolution: {
      mode: gubeiMode,
      chosenPlaceId: chosenGubeiPlaceId,
      chosenDisplayName: chosenGubeiDisplayName,
      gubeikouPresentInCatalog: hasGubeikouInCatalog,
    },
    countries: {
      legacySourceCodeUpdates: countrySourceCodeUpdates.length,
      catalogCountryLinkUpdates: catalogCountryUpdates.length,
      sampleLinkedCountries: catalogCountryUpdates.slice(0, 15).map(c => ({
        code: c.code,
        nameRu: c.afterNameRu,
        legacyCountryId: c.afterLegacyCountryId,
      })),
    },
    curatedAliases: curatedAliases.map(a => ({
      sourceId: a.sourceId,
      placeId: a.placeId,
      name: a.name,
      isPreferred: a.isPreferred,
      note: a.note,
    })),
    cityResolution: {
      highlightsToResolve: plannedHighlightUpdates.length,
      highlightsByLabel: plannedHighlightUpdates.reduce<Record<string, { count: number, afterCity: string, placeId: string }>>((acc, item) => {
        const entry = acc[item.beforeCity] ?? { count: 0, afterCity: item.afterCity, placeId: item.placeId }
        entry.count++
        acc[item.beforeCity] = entry
        return acc
      }, {}),
      reviewsToResolve: plannedReviewUpdates.length,
      metrosToResolve: plannedMetroUpdates.length,
      flightSegmentsToFix: plannedFlightChanges.map(f => ({
        sectionId: f.sectionId,
        field: f.cityField,
        before: f.beforeLabel,
        action: f.action,
        after: f.afterLabel,
        placeId: f.placeId,
      })),
      remainingUnresolved: {
        highlights: remainingUnresolvedHighlights,
        reviews: remainingUnresolvedReviews,
        metros: remainingUnresolvedMetros,
        flights: remainingUnresolvedFlights,
      },
    },
    weatherBackfill: {
      tripsToBackfill: plannedTripWeatherUpdates.length,
      totalCityWeatherEntriesCopied: plannedTripWeatherUpdates.reduce((sum, t) => sum + t.addedPlaceIds.length, 0),
      trips: plannedTripWeatherUpdates.map(t => ({
        tripId: t.tripId,
        title: t.title,
        matchedKeys: t.matchedKeys,
      })),
    },
    cutoverReadinessAfterRun: readiness,
    nextStep: apply
      ? 'Все изменения успешно записаны в одной транзакции.'
      : 'Это dry-run. Проверьте отчёт выше и запустите с флагом --apply для записи в БД.',
  }, null, 2))
}

async function run() {
  try {
    await main()
  }
  catch (error) {
    console.error('Ошибка в geo:prepare-cutover:', error)
    process.exitCode = 1
  }
  finally {
    await pool.end()
  }
}

void run()
