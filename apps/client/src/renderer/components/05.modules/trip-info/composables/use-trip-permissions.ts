import { useOnline } from '@vueuse/core'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useAppStore } from '~/shared/composables/use-store'

export function useTripPermissions() {
  const { auth } = useAppStore(['auth'])
  const { plan } = useModuleStore(['plan'])
  const isOnline = useOnline()

  const canEdit = computed(() => {
    // В офлайн-режиме редактирование блокируется для предотвращения сетевых сбоев и рассинхронизации
    if (!isOnline.value)
      return false

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

  const isOwner = computed(() => {
    const currentUser = auth.user
    const trip = plan.trip
    if (!currentUser || !trip)
      return false

    return Boolean(trip.userId && trip.userId === currentUser.id)
  })

  return {
    canEdit,
    isOwner,
  }
}
