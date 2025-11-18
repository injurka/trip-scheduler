/* eslint-disable no-console */
import axios from 'axios'
import { z } from 'zod'

// eslint-disable-next-line unused-imports/no-unused-vars
const RecommendationSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  locationId: z.number(),
  address: z.string(),
})
type Recommendation = z.infer<typeof RecommendationSchema>

const AddressObjSchema = z.object({
  street1: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalcode: z.string().optional(),
  address_string: z.string(),
})

const LocationDataSchema = z.object({
  location_id: z.coerce.number(),
  name: z.string(),
  address_obj: AddressObjSchema,
})

const ApiResponseSchema = z.object({
  data: z.array(LocationDataSchema),
})

interface ScrapeOptions {
  apiKey: string
  latLong: string
  category?: 'attractions' | 'hotels' | 'restaurants'
  language?: string
}

const API_BASE_URL = 'https://api.content.tripadvisor.com/api/v1/location/nearby_search'
const TRIPADVISOR_BASE_URL = 'https://www.tripadvisor.com'

export async function scrapeTripAdvisor(options: ScrapeOptions): Promise<Recommendation[]> {
  const { apiKey, latLong, category = 'attractions', language = 'en' } = options

  if (!apiKey) {
    console.error('API Key is required to use the official Tripadvisor Content API.')
    return []
  }

  const params = new URLSearchParams({
    key: apiKey,
    latLong,
    category,
    language,
  })

  const url = `${API_BASE_URL}?${params.toString()}`
  console.log(`Sending request to official API: ${url}`)

  try {
    const response = await axios.get(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    const validatedResponse = ApiResponseSchema.parse(response.data)

    const recommendations: Recommendation[] = validatedResponse.data.map(location => ({
      locationId: location.location_id,
      title: location.name,
      address: location.address_obj.address_string,
      url: `${TRIPADVISOR_BASE_URL}/Attraction_Review-g${location.location_id}`,
    }))

    console.log(`Successfully received ${recommendations.length} items from the API.`)
    return recommendations
  }
  catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API request failed:', error.response?.status)
      console.error('Response data:', error.response?.data)
    }
    else if (error instanceof z.ZodError) {
      console.error('API response validation failed:', error)
    }
    else {
      console.error('An unexpected error occurred:', error)
    }
    return []
  }
}
