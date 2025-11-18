/**
 * Описывает тег для фильтрации мест.
 */
export interface PlaceTag {
  id: string
  name: string
  icon?: string
}

/**
 * Описывает достопримечательность или место для посещения.
 */
export interface Place {
  id: string
  name: string
  description: string
  city: string
  coordinates: {
    lat: number
    lon: number
  }
  tags: PlaceTag[]
  photoUrl?: string
  rating?: number
  website?: string
}
