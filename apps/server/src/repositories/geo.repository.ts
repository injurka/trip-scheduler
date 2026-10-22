import type { GeoPlaceGetByIdsInput, GeoPlaceSearchInput, ResolveCityInput } from '~/modules/geo/geo.schemas'
import { and, asc, desc, eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '~/../db'
import { geoCatalogCountries, geoCatalogVersions, geoPlaceNames, geoPlaces } from '~/../db/schema'
import { measureDbQuery } from '~/lib/db-monitoring'

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('und')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export const geoRepository = {
  async getCatalogStatus() {
    return measureDbQuery('geoCatalog', 'select', async () => {
      const [version] = await db.select({
        id: geoCatalogVersions.id,
        publishedAt: geoCatalogVersions.publishedAt,
      })
        .from(geoCatalogVersions)
        .where(eq(geoCatalogVersions.state, 'ready'))
        .orderBy(desc(geoCatalogVersions.publishedAt))
        .limit(1)

      if (!version) {
        return {
          ready: false,
          version: null,
          publishedAt: null,
          placeCount: 0,
        }
      }

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(geoPlaces)
        .where(and(
          eq(geoPlaces.catalogVersion, version.id),
          eq(geoPlaces.retired, false),
          eq(geoPlaces.sourcePresentInLatestSubset, true),
        ))

      return {
        ready: true,
        version: version.id,
        publishedAt: version.publishedAt?.toISOString() ?? null,
        placeCount: Number(countResult.count),
      }
    })
  },

  async search(input: GeoPlaceSearchInput) {
    return measureDbQuery('geoCatalog', 'select', async () => {
      const query = normalizeName(input.query)
      if (query.length < 2)
        return []

      const [version] = await db.select({ id: geoCatalogVersions.id })
        .from(geoCatalogVersions)
        .where(eq(geoCatalogVersions.state, 'ready'))
        .orderBy(desc(geoCatalogVersions.publishedAt))
        .limit(1)

      if (!version)
        return []

      const conditions = [
        eq(geoPlaces.catalogVersion, version.id),
        eq(geoPlaces.retired, false),
        eq(geoPlaces.sourcePresentInLatestSubset, true),
        eq(geoPlaceNames.isHistorical, false),
        inArray(geoPlaceNames.language, [input.locale, '']),
        like(geoPlaceNames.prefixKey, `${query}%`),
      ]

      if (input.countryId)
        conditions.push(eq(geoCatalogCountries.legacyCountryId, input.countryId))
      if (input.countryCode)
        conditions.push(eq(geoCatalogCountries.code, input.countryCode))
      if (input.kinds?.length)
        conditions.push(inArray(geoPlaces.kind, input.kinds))

      const displayName = sql<string>`COALESCE((
        SELECT selected_name.name
        FROM geo_place_names AS selected_name
        WHERE selected_name.place_id = ${geoPlaces.id}
          AND selected_name.language IN (${input.locale}, '')
          AND selected_name.is_historical = false
        ORDER BY CASE WHEN selected_name.language = ${input.locale} THEN 0 ELSE 1 END,
          selected_name.is_preferred DESC,
          selected_name.name ASC
        LIMIT 1
      ), ${geoPlaces.primaryName})`.as('name')

      const ranked = db.select({
        id: geoPlaces.id,
        name: displayName,
        countryId: geoCatalogCountries.legacyCountryId,
        countryCode: geoCatalogCountries.code,
        countryName: input.locale === 'ru'
          ? sql<string>`COALESCE(${geoCatalogCountries.nameRu}, ${geoCatalogCountries.sourceName})`.as('country_name')
          : geoCatalogCountries.sourceName,
        regionName: geoPlaces.regionName,
        kind: geoPlaces.kind,
        latitude: geoPlaces.latitude,
        longitude: geoPlaces.longitude,
        timezone: geoPlaces.timezone,
        retired: geoPlaces.retired,
        matchedName: geoPlaceNames.name,
        matchRank: sql<number>`CASE WHEN ${geoPlaceNames.normalizedName} = ${query} THEN 0 ELSE 1 END`.as('match_rank'),
        languageRank: sql<number>`CASE WHEN ${geoPlaceNames.language} = ${input.locale} THEN 0 ELSE 1 END`.as('language_rank'),
        isPreferred: geoPlaceNames.isPreferred,
        population: geoPlaces.population,
        rowNumber: sql<number>`row_number() OVER (
          PARTITION BY ${geoPlaces.id}
          ORDER BY
            CASE WHEN ${geoPlaceNames.normalizedName} = ${query} THEN 0 ELSE 1 END,
            CASE WHEN ${geoPlaceNames.language} = ${input.locale} THEN 0 ELSE 1 END,
            ${geoPlaceNames.isPreferred} DESC,
            ${geoPlaceNames.name} ASC
        )`.as('row_number'),
      })
        .from(geoPlaces)
        .innerJoin(geoCatalogCountries, eq(geoPlaces.countryCode, geoCatalogCountries.code))
        .innerJoin(geoPlaceNames, eq(geoPlaces.id, geoPlaceNames.placeId))
        .where(and(...conditions))
        .as('ranked_places')

      const rows = await db.select({
        id: ranked.id,
        name: ranked.name,
        countryId: ranked.countryId,
        countryCode: ranked.countryCode,
        countryName: ranked.countryName,
        regionName: ranked.regionName,
        kind: ranked.kind,
        latitude: ranked.latitude,
        longitude: ranked.longitude,
        timezone: ranked.timezone,
        retired: ranked.retired,
        matchedName: ranked.matchedName,
      })
        .from(ranked)
        .where(eq(ranked.rowNumber, 1))
        .orderBy(
          asc(ranked.matchRank),
          asc(ranked.languageRank),
          desc(ranked.isPreferred),
          desc(ranked.population),
          asc(ranked.name),
          asc(ranked.id),
        )
        .limit(input.limit)

      return rows
    })
  },

  async resolveExact(input: ResolveCityInput) {
    return measureDbQuery('geoCatalog', 'select', async () => {
      const normalizedName = normalizeName(input.label)
      if (!normalizedName) {
        return {
          status: 'unresolved' as const,
          reason: 'empty_normalized_label',
          place: null,
          candidates: [],
          provenance: { method: 'normalized_exact_name' },
        }
      }

      let countryCode = input.countryCode
      if (input.countryId) {
        const [mappedCountry] = await db.select({ code: geoCatalogCountries.code })
          .from(geoCatalogCountries)
          .where(eq(geoCatalogCountries.legacyCountryId, input.countryId))
          .limit(1)
        if (!mappedCountry) {
          return {
            status: 'unresolved' as const,
            reason: 'country_not_mapped',
            place: null,
            candidates: [],
            provenance: { method: 'normalized_exact_name', countryId: input.countryId },
          }
        }
        if (countryCode && countryCode !== mappedCountry.code) {
          return {
            status: 'unresolved' as const,
            reason: 'country_context_conflict',
            place: null,
            candidates: [],
            provenance: { method: 'normalized_exact_name', countryId: input.countryId, countryCode },
          }
        }
        countryCode = mappedCountry.code
      }

      const [version] = await db.select({ id: geoCatalogVersions.id })
        .from(geoCatalogVersions)
        .where(eq(geoCatalogVersions.state, 'ready'))
        .orderBy(desc(geoCatalogVersions.publishedAt))
        .limit(1)
      if (!version) {
        return {
          status: 'unresolved' as const,
          reason: 'catalog_unavailable',
          place: null,
          candidates: [],
          provenance: { method: 'normalized_exact_name' },
        }
      }

      const conditions = [
        eq(geoPlaces.catalogVersion, version.id),
        eq(geoPlaces.retired, false),
        eq(geoPlaces.sourcePresentInLatestSubset, true),
        eq(geoPlaceNames.normalizedName, normalizedName),
        eq(geoPlaceNames.isHistorical, false),
        inArray(geoPlaceNames.language, ['ru', 'en', '']),
        inArray(geoPlaces.kind, input.kinds?.length ? input.kinds : ['settlement']),
      ]
      if (countryCode)
        conditions.push(eq(geoPlaces.countryCode, countryCode))
      if (input.regionName)
        conditions.push(eq(geoPlaces.regionName, input.regionName))

      const languageRank = sql<number>`CASE WHEN ${geoPlaceNames.language} = 'ru' THEN 0 WHEN ${geoPlaceNames.language} = '' THEN 1 ELSE 2 END`
      const rows = await db.select({
        placeId: geoPlaces.id,
        matchedName: geoPlaceNames.name,
        languageRank,
        population: geoPlaces.population,
        countryCode: geoPlaces.countryCode,
      })
        .from(geoPlaces)
        .innerJoin(geoCatalogCountries, eq(geoPlaces.countryCode, geoCatalogCountries.code))
        .innerJoin(geoPlaceNames, eq(geoPlaceNames.placeId, geoPlaces.id))
        .where(and(...conditions))
        .orderBy(asc(languageRank), desc(geoPlaces.population), asc(geoPlaces.countryCode), asc(geoPlaces.id))
        .limit(50)

      const matchingRows = new Map<string, typeof rows[number]>()
      for (const row of rows) {
        if (!matchingRows.has(row.placeId))
          matchingRows.set(row.placeId, row)
      }
      const candidates = [...matchingRows.values()].slice(0, 10)
      const places = await this.getByIds({ ids: candidates.map(candidate => candidate.placeId), locale: 'ru' })
      const placeById = new Map(places.map(place => [place.id, place]))
      const resolutionCandidates = candidates.flatMap((candidate) => {
        const place = placeById.get(candidate.placeId)
        return place ? [{ place, score: 1, matchedName: candidate.matchedName }] : []
      })

      return {
        status: resolutionCandidates.length === 1 ? 'resolved' as const : resolutionCandidates.length > 1 ? 'needs_review' as const : 'unresolved' as const,
        reason: resolutionCandidates.length === 1 ? 'unique_exact_name' : resolutionCandidates.length > 1 ? 'ambiguous_exact_name' : 'exact_name_not_found',
        place: resolutionCandidates.length === 1 ? resolutionCandidates[0]!.place : null,
        candidates: resolutionCandidates,
        provenance: {
          method: 'normalized_exact_name',
          countryCode: countryCode ?? null,
          regionName: input.regionName ?? null,
          candidateCountCapped: rows.length === 50,
        },
      }
    })
  },

  async getByIds(input: GeoPlaceGetByIdsInput) {
    return measureDbQuery('geoCatalog', 'select', async () => {
      if (!input.ids.length)
        return []

      const places = await db.select({
        id: geoPlaces.id,
        primaryName: geoPlaces.primaryName,
        countryId: geoCatalogCountries.legacyCountryId,
        countryCode: geoCatalogCountries.code,
        countryName: input.locale === 'ru'
          ? sql<string>`COALESCE(${geoCatalogCountries.nameRu}, ${geoCatalogCountries.sourceName})`
          : geoCatalogCountries.sourceName,
        regionName: geoPlaces.regionName,
        kind: geoPlaces.kind,
        latitude: geoPlaces.latitude,
        longitude: geoPlaces.longitude,
        timezone: geoPlaces.timezone,
        retired: geoPlaces.retired,
      })
        .from(geoPlaces)
        .innerJoin(geoCatalogCountries, eq(geoPlaces.countryCode, geoCatalogCountries.code))
        .where(inArray(geoPlaces.id, input.ids))

      const names = places.length
        ? await db.select({
            placeId: geoPlaceNames.placeId,
            language: geoPlaceNames.language,
            name: geoPlaceNames.name,
            isPreferred: geoPlaceNames.isPreferred,
          })
            .from(geoPlaceNames)
            .where(and(
              inArray(geoPlaceNames.placeId, places.map(place => place.id)),
              inArray(geoPlaceNames.language, [input.locale, '']),
              eq(geoPlaceNames.isHistorical, false),
            ))
            .orderBy(
              sql`CASE WHEN ${geoPlaceNames.language} = ${input.locale} THEN 0 ELSE 1 END`,
              desc(geoPlaceNames.isPreferred),
              asc(geoPlaceNames.name),
            )
        : []

      const displayNames = new Map<string, string>()
      for (const name of names) {
        if (!displayNames.has(name.placeId))
          displayNames.set(name.placeId, name.name)
      }

      const byId = new Map(places.map(place => [place.id, {
        id: place.id,
        name: displayNames.get(place.id) ?? place.primaryName,
        countryId: place.countryId,
        countryCode: place.countryCode,
        countryName: place.countryName,
        regionName: place.regionName,
        kind: place.kind,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
        retired: place.retired,
      }]))

      return input.ids.flatMap((id) => {
        const place = byId.get(id)
        return place ? [place] : []
      })
    })
  },

  async getSelectableIds(ids: string[]) {
    return measureDbQuery('geoCatalog', 'select', async () => {
      if (!ids.length)
        return []

      const [version] = await db.select({ id: geoCatalogVersions.id })
        .from(geoCatalogVersions)
        .where(eq(geoCatalogVersions.state, 'ready'))
        .orderBy(desc(geoCatalogVersions.publishedAt))
        .limit(1)

      if (!version)
        return []

      const rows = await db.select({ id: geoPlaces.id })
        .from(geoPlaces)
        .where(and(
          inArray(geoPlaces.id, ids),
          eq(geoPlaces.catalogVersion, version.id),
          eq(geoPlaces.retired, false),
          eq(geoPlaces.sourcePresentInLatestSubset, true),
        ))

      return rows.map(row => row.id)
    })
  },
}
