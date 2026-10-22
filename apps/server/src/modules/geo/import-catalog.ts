/* eslint-disable no-console */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { db, pool } from 'db'
import { and, eq, isNull, not, sql } from 'drizzle-orm'
import { geoCatalogCountries, geoCatalogVersions, geoPlaceNames, geoPlaces, countries as legacyCountries } from '~/../db/schema'
import { geoNamesPlaceId } from './geo-id'

const SOURCE_URLS = {
  cities: 'https://download.geonames.org/export/dump/cities500.zip',
  countries: 'https://download.geonames.org/export/dump/countryInfo.txt',
  admin1: 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
  alternateNames: 'https://download.geonames.org/export/dump/alternateNamesV2.zip',
} as const

const ALLOWED_FEATURE_CODES = new Set([
  'PPL',
  'PPLA',
  'PPLA2',
  'PPLA3',
  'PPLA4',
  'PPLA5',
  'PPLC',
  'PPLCD',
  'PPLF',
  'PPLG',
  'PPLL',
  'PPLR',
  'STLMT',
])
const BATCH_SIZE = 500
const IMPORTER_VERSION = '1.0.0'
const PINNED_CITIES500_SHA256 = '3b8292a6ffcb11d87aa3b2dff47972fb0c8c0ed7245d54227db8f2ca1c81fc7f'
let ownedTemporaryDirectory: string | undefined

interface CountryRecord {
  code: string
  geonamesId: string
  sourceName: string
  asciiName: string
  nameRu: string | null
  sourceModifiedAt: string | null
  legacyCountryId: string | null
}

interface PlaceRecord {
  id: string
  sourceId: string
  countryCode: string
  featureCode: string
  primaryName: string
  asciiName: string
  latitude: number
  longitude: number
  admin1Code: string | null
  admin2Code: string | null
  regionName: string | null
  timezone: string | null
  population: number
  sourceModifiedAt: string | null
}

interface PlaceNameRecord {
  placeId: string
  language: string
  name: string
  normalizedName: string
  prefixKey: string
  origin: 'geonames_primary' | 'geonames_ascii' | 'geonames_alternate'
  isPreferred: boolean
  isHistorical: boolean
  sourceNameId: string | null
}

interface AlternateName {
  placeId: string
  language: string
  name: string
  normalizedName: string
  prefixKey: string
  origin: 'geonames_alternate'
  isPreferred: boolean
  isHistorical: boolean
  sourceNameId: string
}

function option(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`
  const value = process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
  return value || fallback
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
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

function mapLegacyCountryCodes(
  catalogCountries: Array<Pick<CountryRecord, 'code' | 'sourceName' | 'asciiName' | 'nameRu'>>,
  legacyCountryRows: Array<Pick<typeof legacyCountries.$inferSelect, 'id' | 'name' | 'sourceCode'>>,
) {
  const mappedByCode = new Map<string, string>()
  const unmappedLegacyCountries = legacyCountryRows.filter(country => !country.sourceCode)
  const candidatesByCode = new Map<string, Set<string>>()
  const candidateCodesByLegacyId = new Map<string, Set<string>>()

  for (const country of catalogCountries) {
    const existingMapping = legacyCountryRows.find(row => row.sourceCode === country.code)
    if (existingMapping) {
      mappedByCode.set(country.code, existingMapping.id)
      continue
    }

    const aliases = new Set([country.nameRu, country.sourceName, country.asciiName]
      .filter((name): name is string => Boolean(name))
      .map(normalizeName))
    const candidateIds = new Set(unmappedLegacyCountries
      .filter(row => aliases.has(normalizeName(row.name)))
      .map(row => row.id))
    candidatesByCode.set(country.code, candidateIds)

    for (const id of candidateIds) {
      const codes = candidateCodesByLegacyId.get(id) ?? new Set<string>()
      codes.add(country.code)
      candidateCodesByLegacyId.set(id, codes)
    }
  }

  const autoAssignments = new Map<string, string>()
  for (const [code, candidateIds] of candidatesByCode) {
    if (candidateIds.size !== 1)
      continue
    const [legacyId] = candidateIds
    if (!legacyId || candidateCodesByLegacyId.get(legacyId)?.size !== 1)
      continue
    mappedByCode.set(code, legacyId)
    autoAssignments.set(legacyId, code)
  }

  return { mappedByCode, autoAssignments }
}

function asNullable(value: string | undefined): string | null {
  return value && value !== '\\N' ? value : null
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true'
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath))
    hash.update(chunk)
  return hash.digest('hex')
}

async function download(url: string, filePath: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(2 * 60 * 60 * 1000) })
  if (!response.ok)
    throw new Error(`Download failed (${response.status} ${response.statusText}): ${url}`)
  const temporaryPath = `${filePath}.part`
  try {
    await Bun.write(temporaryPath, response)
    await rename(temporaryPath, filePath)
  }
  catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

async function* readZipLines(zipPath: string, member: string): AsyncGenerator<string> {
  const child = spawn('unzip', ['-p', zipPath, member], { stdio: ['ignore', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  let exitCode: number | null = null
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => {
      exitCode = code
      resolve()
    })
  })

  for await (const line of lines)
    yield line
  await closed
  if (exitCode !== 0)
    throw new Error(`unzip failed for ${path.basename(zipPath)}:${member} (exit ${exitCode})`)
}

async function* readTextLines(filePath: string): AsyncGenerator<string> {
  const lines = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of lines)
    yield line
}

async function downloadSnapshot(directory: string) {
  await mkdir(directory, { recursive: true })
  const paths = {
    cities: path.join(directory, 'cities500.zip'),
    countries: path.join(directory, 'countryInfo.txt'),
    admin1: path.join(directory, 'admin1CodesASCII.txt'),
    alternateNames: path.join(directory, 'alternateNamesV2.zip'),
  }
  console.info('Downloading GeoNames city, country, region, and alternate-name snapshots...')
  const sources = [
    ['cities', SOURCE_URLS.cities],
    ['countries', SOURCE_URLS.countries],
    ['admin1', SOURCE_URLS.admin1],
    ['alternateNames', SOURCE_URLS.alternateNames],
  ] as const
  await Promise.all(sources.map(async ([key, url]) => {
    const filePath = paths[key]
    const reuse = !hasFlag('refresh') && await stat(filePath).then(info => info.size > 0).catch(() => false)
    if (reuse) {
      console.info(`Reusing cached ${path.basename(filePath)}`)
      return
    }
    await download(url, filePath)
  }))
  return paths
}

async function readCountryInfo(filePath: string): Promise<Map<string, Omit<CountryRecord, 'nameRu' | 'legacyCountryId'>>> {
  const countries = new Map<string, Omit<CountryRecord, 'nameRu' | 'legacyCountryId'>>()
  for await (const line of readTextLines(filePath)) {
    if (!line || line.startsWith('#'))
      continue
    const fields = line.split('\t')
    const code = fields[0]?.toUpperCase()
    const geonamesId = fields[16]
    const sourceName = fields[4]
    if (!code || !geonamesId || !sourceName)
      continue
    countries.set(code, {
      code,
      geonamesId,
      sourceName,
      asciiName: sourceName,
      sourceModifiedAt: null,
    })
  }
  return countries
}

async function readAdmin1(filePath: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  for await (const line of readTextLines(filePath)) {
    const [key, name] = line.split('\t')
    if (key && name)
      names.set(key, name)
  }
  return names
}

async function readCities(zipPath: string, admin1Names: Map<string, string>) {
  const places: PlaceRecord[] = []
  const countryCodes = new Set<string>()
  let rejectedRows = 0
  let sourceRows = 0

  for await (const line of readZipLines(zipPath, 'cities500.txt')) {
    sourceRows++
    const fields = line.split('\t')
    if (fields.length < 19) {
      rejectedRows++
      continue
    }

    const [sourceId, primaryName, asciiName, , latitudeRaw, longitudeRaw, featureClass, featureCode, countryCodeRaw, , admin1CodeRaw, admin2CodeRaw, , , populationRaw, , , timezoneRaw, modifiedAt] = fields
    const countryCode = countryCodeRaw?.toUpperCase()
    const latitude = Number(latitudeRaw)
    const longitude = Number(longitudeRaw)
    const population = Number(populationRaw || 0)
    if (
      !sourceId
      || !primaryName
      || !asciiName
      || featureClass !== 'P'
      || !featureCode
      || !ALLOWED_FEATURE_CODES.has(featureCode)
      || !countryCode
      || !/^[A-Z]{2}$/.test(countryCode)
      || !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || !Number.isSafeInteger(population)
    ) {
      rejectedRows++
      continue
    }

    countryCodes.add(countryCode)
    const admin1Code = asNullable(admin1CodeRaw)
    places.push({
      id: geoNamesPlaceId(sourceId),
      sourceId,
      countryCode,
      featureCode,
      primaryName,
      asciiName,
      latitude,
      longitude,
      admin1Code,
      admin2Code: asNullable(admin2CodeRaw),
      regionName: admin1Code ? admin1Names.get(`${countryCode}.${admin1Code}`) ?? null : null,
      timezone: asNullable(timezoneRaw),
      population,
      sourceModifiedAt: asNullable(modifiedAt),
    })

    if (sourceRows % 100_000 === 0)
      console.info(`Read ${sourceRows.toLocaleString()} GeoNames city rows...`)
  }

  return { places, countryCodes, sourceRows, rejectedRows }
}

function parseAlternate(line: string): AlternateName | null {
  const fields = line.split('\t')
  const sourceNameId = fields[0]
  const sourceId = fields[1]
  const sourceLanguage = fields[2]?.toLowerCase().split('-')[0]
  const name = fields[3]
  if (!sourceNameId || !sourceId || !name || !['ru', 'en'].includes(sourceLanguage ?? ''))
    return null

  const language = sourceLanguage!
  const normalizedName = normalizeName(name)
  if (!normalizedName)
    return null

  return {
    placeId: sourceId,
    language,
    name,
    normalizedName,
    prefixKey: normalizedName,
    origin: 'geonames_alternate',
    isPreferred: parseBoolean(fields[4]),
    isHistorical: parseBoolean(fields[7]),
    sourceNameId,
  }
}

async function readAlternateNames(zipPath: string, places: PlaceRecord[], countries: Map<string, Omit<CountryRecord, 'nameRu' | 'legacyCountryId'>>) {
  const placeIds = new Set(places.map(place => place.sourceId))
  const countryIds = new Map([...countries.values()].map(country => [country.geonamesId, country.code]))
  const names = new Map<string, AlternateName>()
  const preferredCountryNames = new Map<string, { name: string, preferred: boolean }>()
  let scanned = 0

  for await (const line of readZipLines(zipPath, 'alternateNamesV2.txt')) {
    scanned++
    const fields = line.split('\t')
    const sourceId = fields[1]
    const language = fields[2]?.toLowerCase().split('-')[0]
    const alias = fields[3]
    if (sourceId && language === 'ru' && alias && !parseBoolean(fields[7]) && countryIds.has(sourceId)) {
      const code = countryIds.get(sourceId)!
      const preferred = parseBoolean(fields[4])
      const previous = preferredCountryNames.get(code)
      if (!previous || (!previous.preferred && preferred))
        preferredCountryNames.set(code, { name: alias, preferred })
    }

    const alternate = parseAlternate(line)
    if (alternate && !alternate.isHistorical && placeIds.has(alternate.placeId)) {
      const key = `${alternate.placeId}\u0000${alternate.language}\u0000${alternate.normalizedName}`
      const previous = names.get(key)
      if (!previous || (!previous.isPreferred && alternate.isPreferred))
        names.set(key, alternate)
    }

    if (scanned % 5_000_000 === 0)
      console.info(`Scanned ${scanned.toLocaleString()} alternate names; kept ${names.size.toLocaleString()} city aliases...`)
  }

  return { names: [...names.values()], preferredCountryNames, scanned }
}

function createPlaceName(placeId: string, language: string, name: string, origin: PlaceNameRecord['origin'], isPreferred: boolean): PlaceNameRecord | null {
  const normalizedName = normalizeName(name)
  if (!normalizedName)
    return null
  return {
    placeId,
    language,
    name,
    normalizedName,
    prefixKey: normalizedName,
    origin,
    isPreferred,
    isHistorical: false,
    sourceNameId: null,
  }
}

async function* chunks<T>(items: T[], size: number): AsyncGenerator<T[]> {
  for (let index = 0; index < items.length; index += size)
    yield items.slice(index, index + size)
}

async function main() {
  const apply = hasFlag('apply')
  const dataDirectory = option('data-dir')
  ownedTemporaryDirectory = dataDirectory ? undefined : await mkdtemp(path.join(tmpdir(), 'trip-scheduler-geonames-'))
  const directory = dataDirectory ?? ownedTemporaryDirectory!
  const paths = await downloadSnapshot(directory)
  const sourceHashes = {
    cities500: await sha256(paths.cities),
    countryInfo: await sha256(paths.countries),
    admin1CodesASCII: await sha256(paths.admin1),
    alternateNamesV2: await sha256(paths.alternateNames),
  }
  const expectedCitiesHash = option('expected-cities-sha256', PINNED_CITIES500_SHA256)
  if (expectedCitiesHash && expectedCitiesHash.toLowerCase() !== sourceHashes.cities500)
    throw new Error(`cities500 SHA-256 mismatch: expected ${expectedCitiesHash}, received ${sourceHashes.cities500}`)

  const countryInfo = await readCountryInfo(paths.countries)
  const admin1Names = await readAdmin1(paths.admin1)
  const { places, countryCodes, sourceRows, rejectedRows } = await readCities(paths.cities, admin1Names)
  const missingCountries = [...countryCodes].filter(code => !countryInfo.has(code))
  if (missingCountries.length)
    throw new Error(`countryInfo.txt is missing ${missingCountries.length} country codes: ${missingCountries.join(', ')}`)

  const alternateResult = await readAlternateNames(paths.alternateNames, places, countryInfo)
  const existingLegacyCountries = await db.select({
    id: legacyCountries.id,
    name: legacyCountries.name,
    sourceCode: legacyCountries.sourceCode,
  }).from(legacyCountries)
  const catalogCountryNames = [...countryCodes].map(code => ({
    ...countryInfo.get(code)!,
    nameRu: alternateResult.preferredCountryNames.get(code)?.name ?? null,
  }))
  const countryMapping = mapLegacyCountryCodes(catalogCountryNames, existingLegacyCountries)
  const checksum = createHash('sha256').update(Object.values(sourceHashes).join(':')).digest('hex')
  const versionId = `geonames-cities500-${checksum.slice(0, 24)}`
  const downloadedAt = new Date()
  const counts = {
    sourceRows,
    places: places.length,
    rejectedRows,
    countries: countryCodes.size,
    aliases: alternateResult.names.length,
    scannedAlternateNames: alternateResult.scanned,
  }
  const manifest = {
    license: 'GeoNames data is licensed under CC BY 4.0',
    sources: SOURCE_URLS,
    sourceHashes,
    featureCodes: [...ALLOWED_FEATURE_CODES],
    aliasLanguages: ['ru', 'en'],
    downloadedAt: downloadedAt.toISOString(),
  }

  console.info(`Prepared GeoNames import ${versionId}: ${JSON.stringify(counts)}`)
  console.info(`Country mapping: ${countryMapping.mappedByCode.size}/${countryCodes.size} GeoNames codes mapped to existing countries; ${countryMapping.autoAssignments.size} exact unique matches will populate countries.source_code.`)
  if (countryMapping.autoAssignments.size > 0) {
    const legacyNamesById = new Map(existingLegacyCountries.map(country => [country.id, country.name]))
    console.info(`Exact unique country matches: ${JSON.stringify([...countryMapping.autoAssignments].map(([id, code]) => ({ code, country: legacyNamesById.get(id), id })))}`)
  }
  if (countryMapping.mappedByCode.size < countryCodes.size) {
    const unmapped = [...countryCodes].filter(code => !countryMapping.mappedByCode.has(code))
    console.info(`Unmapped country codes remain unassociated: ${unmapped.join(', ')}`)
  }
  if (!apply) {
    console.info('Dry run only. Pass --apply to write this catalog into PostgreSQL.')
    return
  }

  const existingVersion = await db.select({ id: geoCatalogVersions.id, state: geoCatalogVersions.state }).from(geoCatalogVersions).where(eq(geoCatalogVersions.id, versionId)).limit(1)
  if (existingVersion[0]?.state === 'ready') {
    console.info(`Catalog ${versionId} is already ready; no rows changed.`)
    return
  }

  const countries = [...countryCodes].map((code) => {
    const country = countryInfo.get(code)!
    return {
      ...country,
      nameRu: alternateResult.preferredCountryNames.get(code)?.name ?? null,
      legacyCountryId: countryMapping.mappedByCode.get(code) ?? null,
      catalogVersion: versionId,
    }
  })
  const placeNames = new Map<string, PlaceNameRecord>()
  const nameForSourceId = new Map(places.map(place => [place.sourceId, place.id]))
  for (const place of places) {
    for (const row of [
      createPlaceName(place.id, '', place.primaryName, 'geonames_primary', true),
      createPlaceName(place.id, '', place.asciiName, 'geonames_ascii', false),
    ]) {
      if (row)
        placeNames.set(`${row.placeId}\u0000${row.language}\u0000${row.normalizedName}`, row)
    }
  }
  for (const alternate of alternateResult.names) {
    const placeId = nameForSourceId.get(alternate.placeId)
    if (!placeId)
      continue
    const row: PlaceNameRecord = { ...alternate, placeId }
    const key = `${placeId}\u0000${row.language}\u0000${row.normalizedName}`
    const previous = placeNames.get(key)
    if (!previous || (!previous.isPreferred && row.isPreferred))
      placeNames.set(key, row)
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('trip-scheduler-geo-catalog-import'))`)
      await tx.insert(geoCatalogVersions).values({
        id: versionId,
        manifest,
        checksum,
        state: 'loading',
        importerVersion: IMPORTER_VERSION,
        counts,
        downloadedAt,
      }).onConflictDoUpdate({
        target: geoCatalogVersions.id,
        set: { manifest, checksum, state: 'loading', importerVersion: IMPORTER_VERSION, counts, downloadedAt, publishedAt: null, updatedAt: new Date() },
      })

      await tx.update(geoPlaces).set({ sourcePresentInLatestSubset: false, updatedAt: new Date() }).where(eq(geoPlaces.source, 'geonames'))
      await tx.delete(geoPlaceNames).where(not(eq(geoPlaceNames.origin, 'app_override')))

      for (const [legacyId, sourceCode] of countryMapping.autoAssignments) {
        await tx.update(legacyCountries)
          .set({ sourceCode })
          .where(and(eq(legacyCountries.id, legacyId), isNull(legacyCountries.sourceCode)))
      }

      for await (const batch of chunks(countries, BATCH_SIZE)) {
        await tx.insert(geoCatalogCountries).values(batch).onConflictDoUpdate({
          target: geoCatalogCountries.code,
          set: {
            geonamesId: sql`excluded.geonames_id`,
            sourceName: sql`excluded.source_name`,
            asciiName: sql`excluded.ascii_name`,
            nameRu: sql`COALESCE(excluded.name_ru, geo_catalog_countries.name_ru)`,
            legacyCountryId: sql`COALESCE(excluded.legacy_country_id, geo_catalog_countries.legacy_country_id)`,
            sourceModifiedAt: sql`excluded.source_modified_at`,
            catalogVersion: sql`excluded.catalog_version`,
            updatedAt: new Date(),
          },
        })
      }

      for await (const batch of chunks(places, BATCH_SIZE)) {
        await tx.insert(geoPlaces).values(batch.map(place => ({
          ...place,
          source: 'geonames',
          kind: 'settlement' as const,
          catalogVersion: versionId,
          sourcePresentInLatestSubset: true,
          retired: false,
        }))).onConflictDoUpdate({
          target: [geoPlaces.source, geoPlaces.sourceId],
          set: {
            countryCode: sql`excluded.country_code`,
            catalogVersion: versionId,
            featureCode: sql`excluded.feature_code`,
            kind: 'settlement',
            primaryName: sql`excluded.primary_name`,
            asciiName: sql`excluded.ascii_name`,
            latitude: sql`excluded.latitude`,
            longitude: sql`excluded.longitude`,
            admin1Code: sql`excluded.admin1_code`,
            admin2Code: sql`excluded.admin2_code`,
            regionName: sql`excluded.region_name`,
            timezone: sql`excluded.timezone`,
            population: sql`excluded.population`,
            sourceModifiedAt: sql`excluded.source_modified_at`,
            sourcePresentInLatestSubset: true,
            retired: false,
            updatedAt: new Date(),
          },
        })
      }

      for await (const batch of chunks([...placeNames.values()], BATCH_SIZE)) {
        await tx.insert(geoPlaceNames).values(batch.map(name => ({ ...name, catalogVersion: versionId }))).onConflictDoUpdate({
          target: [geoPlaceNames.placeId, geoPlaceNames.language, geoPlaceNames.normalizedName],
          set: {
            name: sql`excluded.name`,
            prefixKey: sql`excluded.prefix_key`,
            origin: sql`excluded.origin`,
            isPreferred: sql`excluded.is_preferred`,
            isHistorical: sql`excluded.is_historical`,
            sourceNameId: sql`excluded.source_name_id`,
            catalogVersion: versionId,
          },
          setWhere: sql`geo_place_names.origin <> 'app_override'`,
        })
      }

      await tx.update(geoCatalogVersions).set({ state: 'ready', publishedAt: new Date(), updatedAt: new Date() }).where(eq(geoCatalogVersions.id, versionId))
    })
  }
  catch (error) {
    await db.insert(geoCatalogVersions).values({
      id: versionId,
      manifest,
      checksum,
      state: 'failed',
      importerVersion: IMPORTER_VERSION,
      counts,
      downloadedAt,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: geoCatalogVersions.id,
      set: { state: 'failed', updatedAt: new Date() },
    })
    throw error
  }

  const sizeResult = await db.execute(sql`
    SELECT
      pg_total_relation_size('geo_places') AS places_bytes,
      pg_total_relation_size('geo_place_names') AS names_bytes,
      pg_total_relation_size('geo_catalog_countries') AS countries_bytes
  `)
  console.info(`Catalog published. PostgreSQL table+index bytes: ${JSON.stringify(sizeResult.rows[0] ?? {})}`)
}

async function run() {
  try {
    await main()
  }
  catch (error) {
    console.error('GeoNames catalog import failed:', error)
    process.exitCode = 1
  }
  finally {
    if (ownedTemporaryDirectory)
      await rm(ownedTemporaryDirectory, { recursive: true, force: true })
    await pool.end()
  }
}

void run()
