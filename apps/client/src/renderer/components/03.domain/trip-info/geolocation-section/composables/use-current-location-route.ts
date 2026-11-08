import type { Ref } from 'vue'
import type { Coordinate, MapRoute } from '../models/types'
import type { useGeolocationMap } from './use-geolocation-map'
import { onBeforeUnmount, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { routingService } from '~/shared/services/geo'
import { getCurrentCoordinates } from '~/shared/services/geo/current-position'

export function useCurrentLocationRoute(controller: Ref<ReturnType<typeof useGeolocationMap> | undefined>) {
  const isLocating = ref(false)
  const navigationRoute = ref<MapRoute | null>(null)
  const id = `gps-navigation-${crypto.randomUUID()}`
  let disposed = false

  function clearNavigation() {
    controller.value?.removeRoute(id)
    navigationRoute.value?.points.forEach(point => controller.value?.removePoint(point.id))
    navigationRoute.value = null
  }

  async function routeTo(destination: Coordinate) {
    if (isLocating.value)
      return

    const target: Coordinate = [...destination]
    isLocating.value = true

    try {
      const origin = await getCurrentCoordinates()

      if (disposed)
        return

      const points: MapRoute['points'] = [
        { id: `${id}-start`, coordinates: origin, type: 'start', address: 'Вы здесь' },
        { id: `${id}-end`, coordinates: target, type: 'end', address: 'Место назначения' },
      ]
      const result = await routingService.calculateRoute(points, 'foot', id)

      if (disposed)
        return

      if (!result || result.isDirect)
        throw new Error('Не удалось построить пешеходный маршрут по дорогам. Проверьте подключение и повторите попытку.')

      clearNavigation()
      const route: MapRoute = {
        id,
        title: 'От моей GPS-позиции',
        points,
        transportMode: 'foot',
        isVisible: true,
        color: '#2563eb',
        ...result,
      }
      navigationRoute.value = route
      points.forEach(point => controller.value?.addOrUpdatePoint(point))
      controller.value?.addOrUpdateRoute(route)
      controller.value?.fitToContent(points, [route], { padding: 60, maxZoom: 16, duration: 400 })
    }
    catch (error) {
      if (!disposed)
        useToast().error(error instanceof Error ? error.message : 'Не удалось построить маршрут от GPS-позиции.')
    }
    finally {
      isLocating.value = false
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    clearNavigation()
  })

  return { routeTo, isLocating, navigationRoute, clearNavigation }
}
