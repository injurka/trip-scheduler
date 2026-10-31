import { z } from 'zod'

export const AiTripUserPinTypeSchema = z.enum(['place', 'hotel', 'logistics'])

export const AiTripUserPinSchema = z.object({
  type: AiTripUserPinTypeSchema,
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(300).optional(),
})

export const AiTripPlaceCategorySchema = z.enum([
  'attraction',
  'nature',
  'food',
  'culture',
  'relax',
])

export const AiTripHotelTierSchema = z.enum([
  'budget',
  'comfort',
  'boutique',
])

export const AiTripConceptCitySchema = z.object({
  name: z.string().trim().min(1),
  nights: z.number().int().min(0).max(14).catch(1),
  role: z.string().trim().default(''),
})

export const AiTripConceptPlaceSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  city: z.string().trim().default(''),
  category: AiTripPlaceCategorySchema.catch('attraction'),
  whyVisit: z.string().trim().default(''),
  isUserPinned: z.boolean().optional(),
})

export const AiTripConceptHotelSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  city: z.string().trim().default(''),
  area: z.string().trim().default(''),
  pricePerNightRub: z.number().nonnegative().catch(0),
  tier: AiTripHotelTierSchema.catch('comfort'),
  whyStay: z.string().trim().default(''),
  isUserPinned: z.boolean().optional(),
})

export const AiTripConceptDayOutlineSchema = z.object({
  dayNumber: z.number().int().min(1).max(14),
  city: z.string().trim().min(1),
  title: z.string().trim().min(1),
  highlights: z.array(z.string().trim()).default([]),
})

export const AiTripConceptProposalSchema = z.object({
  title: z.string().trim().min(2),
  summary: z.string().trim().min(5),
  estimatedBudgetRub: z.number().nonnegative().catch(0),
  cities: z.array(AiTripConceptCitySchema).min(1),
  places: z.array(AiTripConceptPlaceSchema).min(1),
  hotels: z.array(AiTripConceptHotelSchema).default([]),
  daysOutline: z.array(AiTripConceptDayOutlineSchema).min(1),
})

export const ProposeAiTripConceptInputSchema = z.object({
  country: z.string().trim().min(2).max(100),
  startDate: z.union([z.date(), z.string()]),
  days: z.number().int().min(1).max(14),
  wishes: z.string().max(4000).optional(),
  pinnedItems: z.array(AiTripUserPinSchema).max(30).optional(),
  previousConcept: AiTripConceptProposalSchema.optional(),
  excludedPlaceNames: z.array(z.string().trim()).max(60).optional(),
  refinementFeedback: z.string().trim().max(1500).optional(),
})

export const ApprovedAiTripPlaceSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().default(''),
  category: z.string().optional(),
  whyVisit: z.string().optional(),
})

export const ApprovedAiTripHotelSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().default(''),
  area: z.string().optional(),
  pricePerNightRub: z.number().nonnegative().optional(),
  whyStay: z.string().optional(),
})

export const ApprovedAiTripConceptSchema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(2500),
  estimatedBudgetRub: z.number().nonnegative().optional(),
  cities: z.array(AiTripConceptCitySchema).min(1),
  selectedPlaces: z.array(ApprovedAiTripPlaceSchema).default([]),
  excludedPlaces: z.array(z.string().trim()).default([]),
  selectedHotels: z.array(ApprovedAiTripHotelSchema).default([]),
  daysOutline: z.array(AiTripConceptDayOutlineSchema).min(1),
})

export const GenerateAiTripInputSchema = z.object({
  country: z.string().trim().min(2).max(100),
  startDate: z.union([z.date(), z.string()]),
  days: z.number().int().min(1).max(14),
  wishes: z.string().max(4000).optional(),
  pinnedItems: z.array(AiTripUserPinSchema).max(30).optional(),
  approvedConcept: ApprovedAiTripConceptSchema.optional(),
})

export const GeneratedFileSchema = z.object({
  path: z.string().trim().min(3),
  content: z.string().min(10),
})

export const GeneratedFilesChunkSchema = z.object({
  files: z.array(GeneratedFileSchema).min(1),
})

export type AiTripUserPin = z.infer<typeof AiTripUserPinSchema>
export type AiTripConceptProposal = z.infer<typeof AiTripConceptProposalSchema>
export type ProposeAiTripConceptInput = z.infer<typeof ProposeAiTripConceptInputSchema>
export type ApprovedAiTripConcept = z.infer<typeof ApprovedAiTripConceptSchema>
export type GenerateAiTripInput = z.infer<typeof GenerateAiTripInputSchema>
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>
