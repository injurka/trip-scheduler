import { z } from 'zod'

export const GeoPlaceKindSchema = z.enum(['settlement', 'island', 'area'])
export const GeoLocaleSchema = z.enum(['ru', 'en'])
export const GeoResolutionStatusSchema = z.enum(['resolved', 'unresolved', 'needs_review'])

export const GeoPlaceRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  countryId: z.string().min(1).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  countryName: z.string().min(1),
  regionName: z.string().nullable(),
  kind: GeoPlaceKindSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().nullable(),
  retired: z.boolean(),
})

export const TripCityRefSchema = GeoPlaceRefSchema.extend({
  position: z.number().int().min(0),
})

export const UnresolvedTripCitySchema = z.object({
  position: z.number().int().min(0),
  label: z.string().min(1),
  status: z.enum(['unresolved', 'needs_review']),
})

export const GeoPlaceSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  countryId: z.string().min(1).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  kinds: z.array(GeoPlaceKindSchema).max(3).optional(),
  locale: GeoLocaleSchema.default('ru'),
  limit: z.number().int().min(1).max(30).default(20),
})

export const GeoPlaceGetByIdsInputSchema = z.object({
  ids: z.array(z.string().uuid()).max(100).refine(ids => new Set(ids).size === ids.length, 'ID places must be unique'),
  locale: GeoLocaleSchema.default('ru'),
})

export const GeoPlaceSearchResultSchema = GeoPlaceRefSchema.extend({
  matchedName: z.string().min(1),
})

export const GeoCatalogStatusSchema = z.object({
  ready: z.boolean(),
  version: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
  placeCount: z.number().int().nonnegative(),
})

export const ResolveCityInputSchema = z.object({
  label: z.string().trim().min(1).max(200),
  countryId: z.string().min(1).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  regionName: z.string().trim().min(1).max(200).optional(),
  kinds: z.array(GeoPlaceKindSchema).max(3).optional(),
})

export const GeoResolutionCandidateSchema = z.object({
  place: GeoPlaceRefSchema,
  score: z.number().min(0).max(1),
  matchedName: z.string().min(1),
})

export const GeoResolutionResultSchema = z.object({
  status: z.enum(['resolved', 'unresolved', 'needs_review']),
  reason: z.string().min(1),
  place: GeoPlaceRefSchema.nullable(),
  candidates: z.array(GeoResolutionCandidateSchema).max(10),
  provenance: z.record(z.string(), z.unknown()),
})

export const CityIdsInputSchema = z.array(z.string().uuid()).max(100).refine(ids => new Set(ids).size === ids.length, 'City IDs must be unique')

export const FlightCityIdsSchema = z.object({
  departureCityId: z.string().uuid().optional(),
  arrivalCityId: z.string().uuid().optional(),
  departureCity: z.string().max(200).optional(),
  arrivalCity: z.string().max(200).optional(),
})

export type GeoPlaceRef = z.infer<typeof GeoPlaceRefSchema>
export type TripCityRef = z.infer<typeof TripCityRefSchema>
export type UnresolvedTripCity = z.infer<typeof UnresolvedTripCitySchema>
export type GeoPlaceSearchInput = z.infer<typeof GeoPlaceSearchInputSchema>
export type GeoPlaceGetByIdsInput = z.infer<typeof GeoPlaceGetByIdsInputSchema>
export type ResolveCityInput = z.infer<typeof ResolveCityInputSchema>
