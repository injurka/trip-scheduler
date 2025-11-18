import { z } from 'zod'

const ActivitySectionBaseSchema = z.object({
  id: z.string(),
  isAttached: z.boolean().optional(),
  title: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
})

const ActivitySectionTextSchema = ActivitySectionBaseSchema.extend({
  type: z.literal('description'),
  text: z.string(),
})

const ActivitySectionGallerySchema = ActivitySectionBaseSchema.extend({
  type: z.literal('gallery'),
  imageUrls: z.array(z.string()),
})

const CoordinateSchema = z.tuple([z.number(), z.number()])
const PointTypeSchema = z.enum(['poi', 'start', 'via', 'end'])
const MarkerStyleSchema = z.object({
  iconUrl: z.string().optional(),
  color: z.string().optional(),
  scale: z.number().optional(),
}).optional().nullable()

const MapPointSchema = z.object({
  id: z.string(),
  coordinates: CoordinateSchema,
  type: PointTypeSchema,
  style: MarkerStyleSchema,
  address: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
})

const MapRouteSchema = z.object({
  id: z.string(),
  title: z.string(),
  points: z.array(MapPointSchema),
  color: z.string().optional(),
  distance: z.number().optional(),
  duration: z.number().optional(),
  geometry: z.array(CoordinateSchema).optional(),
  isVisible: z.boolean(),
  isFetching: z.boolean().optional(),
  isDirect: z.boolean().optional(),
})

const DrawnRouteSchema = z.object({
  id: z.string(),
  title: z.string(),
  segments: z.array(z.array(CoordinateSchema)),
  color: z.string().optional(),
  distance: z.number().optional(),
  isVisible: z.boolean(),
})

const ActivitySectionGeolocationSchema = ActivitySectionBaseSchema.extend({
  type: z.literal('geolocation'),
  points: z.array(MapPointSchema),
  routes: z.array(MapRouteSchema),
  drawnRoutes: z.array(DrawnRouteSchema),
  center: CoordinateSchema.optional().nullable(),
  zoom: z.number().optional().nullable(),
})

// Схема для поездки на метро
const MetroRideSchema = z.object({
  id: z.string(),
  startStationId: z.string().nullable().optional(),
  startStation: z.string(),
  endStationId: z.string().nullable().optional(),
  endStation: z.string(),
  lineId: z.string().nullable().optional(),
  lineName: z.string(),
  lineNumber: z.string().nullable().optional(),
  lineColor: z.string(),
  direction: z.string(),
  stops: z.number(),
})

const ActivitySectionMetroSchema = ActivitySectionBaseSchema.extend({
  type: z.literal('metro'),
  mode: z.enum(['free', 'city']).default('free'),
  systemId: z.string().uuid().nullable().default(null),
  rides: z.array(MetroRideSchema),
})

export const ActivitySectionSchema = z.discriminatedUnion('type', [
  ActivitySectionTextSchema,
  ActivitySectionGallerySchema,
  ActivitySectionGeolocationSchema,
  ActivitySectionMetroSchema,
])

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  sections: z.array(ActivitySectionSchema).optional().nullable(),
  tag: z.enum(['transport', 'walk', 'food', 'attraction', 'relax']).optional().nullable(),
  dayId: z.string().uuid(),
  status: z.enum(['none', 'completed', 'skipped']).default('none').optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
})

export const CreateActivityInputSchema = ActivitySchema.pick({
  dayId: true,
  title: true,
  startTime: true,
  endTime: true,
  tag: true,
  sections: true,
  status: true,
  rating: true,
})

export const UpdateActivityInputSchema = ActivitySchema

export const DeleteActivityInputSchema = z.object({
  id: z.string().uuid(),
})
