import { defineStore } from 'pinia'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { urlBase64ToUint8Array } from '~/shared/lib/push-utils'

export enum ENotificationKeys {
  CHECK_SUBSCRIPTION = 'push:check-subscription',
  SUBSCRIBE_TRIP = 'push:subscribe-trip',
  UNSUBSCRIBE_TRIP = 'push:unsubscribe-trip',
  NOTIFY_MEMORY = 'push:notify-memory',
}

export interface NotificationState {
  subscribedTripIds: Set<string>
  loading: boolean
}

const useNotificationStore = defineStore('notification', {
  state: (): NotificationState => ({
    subscribedTripIds: new Set(),
    loading: false,
  }),

  getters: {
    isSubscribedToTrip: state => (tripId: string) => state.subscribedTripIds.has(tripId),
  },

  actions: {
    /**
     * Техническая настройка: проверка прав и получение объекта подписки от браузера.
     */
    async _ensurePushCapability(): Promise<PushSubscription | null> {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push-уведомления не поддерживаются вашим браузером')
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error('VAPID Public Key не найден в переменных окружения (.env)')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Нет разрешения на уведомления. Пожалуйста, разрешите их в настройках браузера.')
      }

      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout: Service Worker не готов. Возможно, он отключен в dev-режиме или не зарегистрирован.')), 3000),
        ),
      ]) as ServiceWorkerRegistration

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }

      return subscription
    },

    /**
     * Проверяет, подписан ли пользователь на конкретное путешествие (на бэкенде).
     */
    async checkTripSubscription(tripId: string) {
      await useRequest({
        key: ENotificationKeys.CHECK_SUBSCRIPTION,
        fn: db => db.notification.checkTripSubscription(tripId),
        onSuccess: (isSubscribed) => {
          if (isSubscribed) {
            this.subscribedTripIds.add(tripId)
          }
          else {
            this.subscribedTripIds.delete(tripId)
          }
        },
      })
    },

    /**
     * Подписывает пользователя на уведомления о конкретном путешествии.
     */
    async subscribeToTrip(tripId: string) {
      this.loading = true
      const toast = useToast()

      try {
        const subscription = await this._ensurePushCapability()

        if (!subscription)
          throw new Error('Не удалось создать подписку')

        await useRequest({
          key: ENotificationKeys.SUBSCRIBE_TRIP,
          fn: db => db.notification.subscribeToTrip({
            tripId,
            subscription: subscription.toJSON(),
          }),
          onSuccess: () => {
            this.subscribedTripIds.add(tripId)
            toast.success('Вы подписались на уведомления об этом путешествии')
          },
          onError: ({ error }) => {
            toast.error(`Ошибка подписки: ${error.customMessage}`)
          },
        })
      }
      catch (e: any) {
        toast.error(e || 'Ошибка настройки уведомлений')
      }
      finally {
        this.loading = false
      }
    },

    /**
     * Отписывает пользователя от уведомлений конкретного путешествия.
     */
    async unsubscribeFromTrip(tripId: string) {
      this.loading = true
      const toast = useToast()

      try {
        await useRequest({
          key: ENotificationKeys.UNSUBSCRIBE_TRIP,
          fn: db => db.notification.unsubscribeFromTrip(tripId),
          onSuccess: () => {
            this.subscribedTripIds.delete(tripId)
            toast.info('Уведомления отключены')
          },
        })
      }
      catch {
        toast.error('Не удалось отписаться')
      }
      finally {
        this.loading = false
      }
    },

    /**
     * Отправляет уведомление другим участникам об обновлении воспоминаний.
     */
    async notifyAboutMemoryUpdate(tripId: string, dayId: string) {
      const toast = useToast()

      await useRequest({
        key: ENotificationKeys.NOTIFY_MEMORY,
        fn: db => db.notification.sendMemoryUpdate({ tripId, dayId }),
        onSuccess: () => {
          toast.info('Уведомления отправлены')
        },
      })
    },
  },
})

export { useNotificationStore }
