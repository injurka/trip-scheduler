import fs from 'node:fs/promises'
import path from 'node:path'
import { db } from 'db'
import { eq, inArray } from 'drizzle-orm'
import {
  geoCatalogCountries,
  geoCatalogVersions,
  geoPlaceNames,
  geoPlaces,
  geoWeatherCache,
} from '~/../db/schema'
import { Logger } from '~/lib/logger'
import { s3Service } from './s3.service'

const logger = new Logger()

export type DumpTarget = 'local' | 's3' | 'both'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function collectReferencedPlaceIds(value: unknown, result: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value)
      collectReferencedPlaceIds(item, result)
    return
  }
  if (!value || typeof value !== 'object')
    return

  for (const [key, nested] of Object.entries(value)) {
    if (/(?:geo)?placeid$|(?:departure|arrival)cityid$/i.test(key) && typeof nested === 'string' && UUID_PATTERN.test(nested))
      result.add(nested)
    if (key === 'weatherByPlaceId' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
      for (const placeId of Object.keys(nested)) {
        if (UUID_PATTERN.test(placeId))
          result.add(placeId)
      }
    }
    collectReferencedPlaceIds(nested, result)
  }
}

async function writeJson(target: DumpTarget, localPath: string, s3Key: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const tasks: Promise<any>[] = []

  if (target === 'local' || target === 'both') {
    tasks.push(
      fs.mkdir(path.dirname(localPath), { recursive: true })
        .then(() => fs.writeFile(localPath, json, 'utf-8')),
    )
  }

  if (target === 's3' || target === 'both') {
    tasks.push(s3Service.uploadFile(s3Key, Buffer.from(json, 'utf-8'), 'application/json'))
  }

  await Promise.all(tasks)
}

export const dumpService = {
  async generateAndUploadDump(target: DumpTarget = 'both') {
    logger.info(`🎬 Начало создания дампа базы данных (Target: ${target})...`)

    try {
      // 1. Загрузка данных
      const [
        allUsers,
        allTrips,
        allPosts,
        allBlogs,
        allMetro,
        allHighlights,
        allDestinationReviews,
        allCountries,
        allTripGeoPlaces,
        allGeoResolutionAudit,
      ] = await Promise.all([
        db.query.users.findMany(),
        db.query.trips.findMany({
          with: {
            user: true,
            days: {
              orderBy: (days, { asc }) => [asc(days.date)],
              with: {
                activities: {
                  orderBy: (activities, { asc }) => [asc(activities.startTime)],
                },
              },
            },
            images: { orderBy: (images, { desc }) => [desc(images.createdAt)] },
            memories: { orderBy: (memories, { asc }) => [asc(memories.timestamp)] },
            participants: true,
            sections: { orderBy: (sections, { asc }) => [asc(sections.order)] },
          },
          orderBy: (trips, { desc }) => [desc(trips.startDate), desc(trips.createdAt)],
        }),
        db.query.posts.findMany({
          with: {
            elements: { orderBy: (elements, { asc }) => [asc(elements.order)] },
            media: true,
            savedBy: true,
          },
          orderBy: (posts, { desc }) => [desc(posts.createdAt)],
        }),
        db.query.blogs.findMany(),
        db.query.metroSystems.findMany({
          with: {
            lines: {
              with: {
                lineStations: {
                  orderBy: (lineStations, { asc }) => [asc(lineStations.order)],
                  with: { station: true },
                },
              },
            },
          },
        }),
        db.query.highlights.findMany({
          with: { country: true }, // <-- Добавлено подтягивание страны
          orderBy: (h, { desc }) => [desc(h.createdAt)],
        }),
        db.query.destinationReviews.findMany({ orderBy: (r, { desc }) => [desc(r.createdAt)] }),
        db.query.countries.findMany({ orderBy: (c, { asc }) => [asc(c.name)] }),
        db.query.tripGeoPlaces.findMany(),
        db.query.geoResolutionAudit.findMany(),
      ])

      // Keep dump size proportional to places used by application records, while retaining
      // enough source rows, localized names and audit provenance to restore every reference offline.
      const referencedPlaceIds = new Set<string>()
      collectReferencedPlaceIds(allTrips, referencedPlaceIds)
      for (const row of allTripGeoPlaces) {
        if (row.placeId)
          referencedPlaceIds.add(row.placeId)
      }
      for (const row of allGeoResolutionAudit) {
        if (row.chosenPlaceId)
          referencedPlaceIds.add(row.chosenPlaceId)
      }
      for (const row of [...allMetro, ...allHighlights, ...allDestinationReviews]) {
        const placeId = 'geoPlaceId' in row ? row.geoPlaceId : undefined
        if (placeId)
          referencedPlaceIds.add(placeId)
      }
      const [appOverridePlaces, appOverrideNameOwners] = await Promise.all([
        db.select({ id: geoPlaces.id }).from(geoPlaces).where(eq(geoPlaces.source, 'app_override')),
        db.select({ placeId: geoPlaceNames.placeId }).from(geoPlaceNames).where(eq(geoPlaceNames.origin, 'app_override')),
      ])
      for (const place of appOverridePlaces)
        referencedPlaceIds.add(place.id)
      for (const name of appOverrideNameOwners)
        referencedPlaceIds.add(name.placeId)

      const placeIds = [...referencedPlaceIds]
      const placeIdChunks = Array.from({ length: Math.ceil(placeIds.length / 30_000) }, (_, index) => placeIds.slice(index * 30_000, (index + 1) * 30_000))
      const referencedGeoRows = await Promise.all(placeIdChunks.map(async (ids) => {
        const [places, names, weatherCache] = await Promise.all([
          db.select().from(geoPlaces).where(inArray(geoPlaces.id, ids)),
          db.select().from(geoPlaceNames).where(inArray(geoPlaceNames.placeId, ids)),
          db.select().from(geoWeatherCache).where(inArray(geoWeatherCache.placeId, ids)),
        ])
        return { places, names, weatherCache }
      }))
      const geoPlacesData = referencedGeoRows.flatMap(row => row.places)
      const geoPlaceNamesData = referencedGeoRows.flatMap(row => row.names)
      const geoWeatherCacheData = referencedGeoRows.flatMap(row => row.weatherCache)
      const catalogCountryCodes = [...new Set(geoPlacesData.map(place => place.countryCode))]
      const [geoCatalogCountriesData, geoCatalogVersionsData] = await Promise.all([
        catalogCountryCodes.length > 0
          ? db.select().from(geoCatalogCountries).where(inArray(geoCatalogCountries.code, catalogCountryCodes))
          : Promise.resolve([]),
        db.select().from(geoCatalogVersions),
      ])
      const geoCatalog = {
        dumpFormatVersion: 1,
        catalogMode: 'referenced-places' as const,
        catalogVersions: geoCatalogVersionsData,
        catalogCountries: geoCatalogCountriesData,
        places: geoPlacesData,
        placeNames: geoPlaceNamesData,
        tripPlaces: allTripGeoPlaces,
        weatherCache: geoWeatherCacheData,
        resolutionAudit: allGeoResolutionAudit,
      }

      logger.info(`🔍 Найдено для дампа:
      Пользователей: ${allUsers.length}, Путешествий: ${allTrips.length},
      Постов: ${allPosts.length}, Статей: ${allBlogs.length}, Метро систем: ${allMetro.length},
      Фото в витрине: ${allHighlights.length}, Впечатлений: ${allDestinationReviews.length},
      Стран: ${allCountries.length}, Geo refs: ${placeIds.length}`)

      const dateFolder = new Date().toISOString().split('T')[0]
      const baseDir = path.resolve(__dirname, '../../db/dump', dateFolder)
      const s3Prefix = `dumps/${dateFolder}`
      let totalFiles = 0

      // 2. users/ — один файл со всеми пользователями
      await writeJson(
        target,
        path.join(baseDir, 'users', 'all.json'),
        `${s3Prefix}/users/all.json`,
        allUsers,
      )
      totalFiles += 1
      logger.info(`   📁 users/all.json (${allUsers.length} пользователей)`)

      // 3. trips/ — по файлу на каждое путешествие
      await Promise.all(
        allTrips.map(trip =>
          writeJson(
            target,
            path.join(baseDir, 'trips', `${trip.id}.json`),
            `${s3Prefix}/trips/${trip.id}.json`,
            trip,
          ),
        ),
      )
      totalFiles += allTrips.length
      logger.info(`   📁 trips/ (${allTrips.length} файлов)`)

      // 4. posts/ — по файлу на каждый пост
      await Promise.all(
        allPosts.map(post =>
          writeJson(
            target,
            path.join(baseDir, 'posts', `${post.id}.json`),
            `${s3Prefix}/posts/${post.id}.json`,
            post,
          ),
        ),
      )
      totalFiles += allPosts.length
      logger.info(`   📁 posts/ (${allPosts.length} файлов)`)

      // 5. blogs/ — по файлу на каждый блог
      await Promise.all(
        allBlogs.map(blog =>
          writeJson(
            target,
            path.join(baseDir, 'blogs', `${blog.id}.json`),
            `${s3Prefix}/blogs/${blog.id}.json`,
            blog,
          ),
        ),
      )
      totalFiles += allBlogs.length
      logger.info(`   📁 blogs/ (${allBlogs.length} файлов)`)

      // 6. metro/ — по файлу на каждый город
      await Promise.all(
        allMetro.map(system =>
          writeJson(
            target,
            path.join(baseDir, 'metro', `${system.city}.json`),
            `${s3Prefix}/metro/${system.city}.json`,
            system,
          ),
        ),
      )
      totalFiles += allMetro.length
      logger.info(`   📁 metro/ (${allMetro.length} файлов)`)

      // 7. highlights/ — один файл на всех
      await writeJson(
        target,
        path.join(baseDir, 'highlights', 'all.json'),
        `${s3Prefix}/highlights/all.json`,
        allHighlights,
      )
      totalFiles += 1
      logger.info(`   📁 highlights/all.json (${allHighlights.length} фото)`)

      // 8. destination-reviews/ — один файл на всех
      await writeJson(
        target,
        path.join(baseDir, 'destination-reviews', 'all.json'),
        `${s3Prefix}/destination-reviews/all.json`,
        allDestinationReviews,
      )
      totalFiles += 1
      logger.info(`   📁 destination-reviews/all.json (${allDestinationReviews.length} впечатлений)`)

      // 9. countries/ — один файл на всех
      await writeJson(
        target,
        path.join(baseDir, 'countries', 'all.json'),
        `${s3Prefix}/countries/all.json`,
        allCountries,
      )
      totalFiles += 1
      logger.info(`   📁 countries/all.json (${allCountries.length} стран)`)

      await writeJson(
        target,
        path.join(baseDir, 'geo', 'catalog.json'),
        `${s3Prefix}/geo/catalog.json`,
        geoCatalog,
      )
      totalFiles += 1
      logger.info(`   📁 geo/catalog.json (${geoCatalog.places.length} referenced places, ${geoCatalog.placeNames.length} names)`)

      logger.success(`✅ Дамп создан: ${totalFiles} файлов`)
      if (target === 'local' || target === 'both')
        logger.success(`   💾 Локально: ${baseDir}`)
      if (target === 's3' || target === 'both')
        logger.success(`   ☁️  S3: ${s3Prefix}/`)

      return {
        baseDir: target !== 's3' ? baseDir : undefined,
        s3Prefix: target !== 'local' ? s3Prefix : undefined,
      }
    }
    catch (error) {
      logger.error('❌ Ошибка при создании дампа:', error)
      throw error
    }
  },
}
