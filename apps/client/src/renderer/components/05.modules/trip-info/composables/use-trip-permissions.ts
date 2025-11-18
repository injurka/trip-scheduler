import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useAppStore } from '~/shared/composables/use-store'

export function useTripPermissions() {
  const { auth } = useAppStore(['auth'])
  const { plan } = useModuleStore(['plan'])

  const canEdit = computed(() => {
    // Администратор может редактировать все
    if (auth.user?.role === 'admin')
      return true

    const currentUser = auth.user
    const participants = plan.trip?.participants

    // Если нет текущего пользователя или списка участников, редактирование запрещено
    if (!currentUser || !participants)
      return false

    // Разрешить редактирование, если текущий пользователь есть в списке участников
    return participants.some(p => p.id === currentUser.id)
  })

  return {
    canEdit,
  }
}
