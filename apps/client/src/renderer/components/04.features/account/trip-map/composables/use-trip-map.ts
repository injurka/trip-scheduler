import type { DestinationMapPoint } from '~/shared/services/api/model/types'
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
      fn: db => db.destinationReviews.getMapPoints(userId),
      onSuccess: (data: DestinationMapPoint[]) => {
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
