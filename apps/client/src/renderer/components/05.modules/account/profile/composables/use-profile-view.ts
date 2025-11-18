import type { ITrip } from '~/components/05.modules/trips-hub/models/types'
import type { User } from '~/shared/types/models/user'
import { useRequest, useRequestStatus } from '~/plugins/request'

enum EProfileViewKeys {
  FETCH_PROFILE = 'profile-view:fetch-profile',
  FETCH_RECENT_TRIPS = 'profile-view:fetch-recent-trips',
}

function useProfileView() {
  const userProfile = ref<User | null>(null)
  const recentTrips = ref<ITrip[]>([])
  const isLoading = useRequestStatus([EProfileViewKeys.FETCH_PROFILE, EProfileViewKeys.FETCH_RECENT_TRIPS])

  async function fetchUserProfile(userId: string) {
    await useRequest({
      key: EProfileViewKeys.FETCH_PROFILE,
      fn: db => db.user.getById(userId),
      onSuccess: (data) => {
        userProfile.value = data
      },
    })
  }

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

    await Promise.all([
      fetchUserProfile(userId),
      fetchRecentTrips(userId),
    ])
  }

  return {
    userProfile,
    recentTrips,
    isLoading,
    init,
  }
}

export { useProfileView }
