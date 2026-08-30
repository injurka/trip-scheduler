import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useAppStore } from '~/shared/composables/use-store'

export function useTripPermissions() {
  const { auth } = useAppStore(['auth'])
  const { plan } = useModuleStore(['plan'])

  const canEdit = computed(() => {
    if (auth.user?.role === 'admin')
      return true

    const currentUser = auth.user
    const trip = plan.trip
    if (!currentUser || !trip)
      return false

    if (trip.userId && trip.userId === currentUser.id)
      return true

    const participants = trip.participants
    if (!participants)
      return false

    return participants.some(p => p.id === currentUser.id)
  })

  return {
    canEdit,
  }
}
