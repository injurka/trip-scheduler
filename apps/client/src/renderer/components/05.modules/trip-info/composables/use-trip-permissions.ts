import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useAppStore } from '~/shared/composables/use-store'

export function useTripPermissions() {
  const { auth } = useAppStore(['auth'])
  const { plan } = useModuleStore(['plan'])

  const canEdit = computed(() => {
    if (auth.user?.role === 'admin')
      return true

    const currentUser = auth.user
    const participants = plan.trip?.participants

    if (!currentUser || !participants)
      return false

    return participants.some(p => p.id === currentUser.id)
  })

  return {
    canEdit,
  }
}
