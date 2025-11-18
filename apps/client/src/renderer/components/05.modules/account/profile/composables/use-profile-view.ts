import type { ITrip } from '~/components/05.modules/trips-hub/models/types'
import { useRequest, useRequestStatus } from '~/plugins/request'

enum EProfileViewKeys {
  FETCH_RECENT_TRIPS = 'profile-view:fetch-recent-trips',
}

function useProfileView() {
  const recentTrips = ref<ITrip[]>([])
  const isLoading = useRequestStatus(EProfileViewKeys.FETCH_RECENT_TRIPS)

  async function fetchRecentTrips(userId: string) {
    await useRequest({
      key: EProfileViewKeys.FETCH_RECENT_TRIPS,
      fn: db => db.trips.listByUser({ userId, limit: 3 }),
      onSuccess: (data) => {
        recentTrips.value = data as ITrip[]
      },
    })
  }

  async function init(userId: string) {
    if (!userId)
      return
    
    await fetchRecentTrips(userId)
  }

  return {
    recentTrips,
    isLoading,
    init,
  }
}

export { useProfileView }
