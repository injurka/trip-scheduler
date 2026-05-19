import type { DestinationReview } from '~/shared/types/models/destination-review'
import { ref } from 'vue'
import { useRequest, useRequestStatus } from '~/plugins/request'

export interface MapCity {
  id: string
  name: string
  country: string
  lat: number
  lon: number
}

enum ETripMapKeys {
  FETCH = 'trip-map:fetch',
}

export function useTripMap(userId: string) {
  const cities = ref<MapCity[]>([])
  const isLoading = useRequestStatus([ETripMapKeys.FETCH])

  async function fetchCities() {
    await useRequest({
      key: ETripMapKeys.FETCH,
      // Uses destination-reviews which already store lat/lon.
      // Replace with db.trips.getVisitedCities({ userId }) if you have a dedicated endpoint.
      fn: db => db.destinationReviews.getUserReviews({ userId }),
      onSuccess: (data: DestinationReview[]) => {
        cities.value = data
          .filter(r => r.latitude != null && r.longitude != null)
          .map(r => ({
            id: r.id,
            name: r.type === 'city' ? (r.city ?? '') : (r.country?.name ?? ''),
            country: r.country?.name ?? '',
            lat: Number(r.latitude),
            lon: Number(r.longitude),
          }))
      },
    })
  }

  return { cities, isLoading, fetchCities }
}
