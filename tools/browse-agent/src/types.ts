export interface LocationInfo {
  name: string
  description: string
  workingHours: string | null
  price: string | null
  tips: string | null
  imageUrls: string[]
  siteUrl: string
  localImages?: string[]
  address?: string
  coordinates?: {
    lat: number
    lng: number
  }
  vibe?: string
}

export interface DayTask {
  dayNumber: string
  locationName: string
  cityName: string
}
