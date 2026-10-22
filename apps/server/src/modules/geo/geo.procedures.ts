import { publicProcedure } from '~/lib/trpc'
import {
  GeoCatalogStatusSchema,
  GeoPlaceGetByIdsInputSchema,
  GeoPlaceRefSchema,
  GeoPlaceSearchInputSchema,
  GeoPlaceSearchResultSchema,
  GeoResolutionResultSchema,
  ResolveCityInputSchema,
} from './geo.schemas'
import { geoService } from './geo.service'

export const geoProcedures = {
  catalogStatus: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/geo/catalog/status',
        tags: ['Geo catalog'],
        summary: 'Получить состояние справочника мест',
      },
    })
    .output(GeoCatalogStatusSchema)
    .query(() => geoService.getCatalogStatus()),

  searchPlaces: publicProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/geo/places/search',
        tags: ['Geo catalog'],
        summary: 'Поиск мест по справочнику',
      },
    })
    .input(GeoPlaceSearchInputSchema)
    .output(GeoPlaceSearchResultSchema.array())
    .query(({ input }) => geoService.search(input)),

  resolveCity: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/geo/places/resolve',
        tags: ['Geo catalog'],
        summary: 'Точное разрешение старой подписи города',
      },
    })
    .input(ResolveCityInputSchema)
    .output(GeoResolutionResultSchema)
    .mutation(({ input }) => geoService.resolveExact(input)),

  getPlacesByIds: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/geo/places/by-ids',
        tags: ['Geo catalog'],
        summary: 'Получить места по ID',
      },
    })
    .input(GeoPlaceGetByIdsInputSchema)
    .output(GeoPlaceRefSchema.array())
    .mutation(({ input }) => geoService.getByIds(input)),
}
