import type { User } from '~/shared/types/models/user'
import { useRequest, useRequestStatus } from '~/plugins/request'

enum EProfileViewKeys {
  FETCH_PROFILE = 'profile-view:fetch-profile',
}

function useProfileView() {
  const userProfile = ref<User | null>(null)
  const isLoading = useRequestStatus([EProfileViewKeys.FETCH_PROFILE])

  async function fetchUserProfile(userId: string) {
    await useRequest({
      key: EProfileViewKeys.FETCH_PROFILE,
      fn: db => db.user.getById(userId),
      onSuccess: (data) => {
        userProfile.value = data
      },
    })
  }

  async function init(userId: string) {
    if (!userId)
      return

    await Promise.all([
      fetchUserProfile(userId),
    ])
  }

  return {
    userProfile,
    isLoading,
    init,
  }
}

export { useProfileView }
