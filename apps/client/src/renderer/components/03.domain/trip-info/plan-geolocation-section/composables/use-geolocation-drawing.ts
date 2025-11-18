import type { LineString } from 'ol/geom'
import type { Ref } from 'vue'
import type { Coordinate } from '../models/types'
import type { useGeolocationMap } from './use-geolocation-map'
import { Draw } from 'ol/interaction'
import { toLonLat } from 'ol/proj'

type GeolocationMapApi = ReturnType<typeof useGeolocationMap>

/**
 * Изолированный хук для управления логикой рисования на карте.
 */
export function useGeolocationDrawing(mapApiRef: Ref<GeolocationMapApi | undefined>) {
  const isDrawing = ref(false)
  let drawInteraction: Draw | null = null

  /**
   * Полностью останавливает режим рисования и удаляет его с карты.
   */
  const stopDrawing = () => {
    if (!isDrawing.value)
      return // Не делаем ничего, если и так не рисуем
    const map = mapApiRef.value?.mapInstance.value
    if (!map)
      return

    if (drawInteraction) {
      map.removeInteraction(drawInteraction)
      drawInteraction = null
    }

    // Возвращаем стандартные взаимодействия
    mapApiRef.value?.modifyInteraction.setActive(true)
    isDrawing.value = false
  }

  /**
   * Запускает режим рисования.
   * @param onDrawEnd - Колбэк, который будет вызван с координатами нарисованной линии.
   */
  const startDrawing = (onDrawEnd: (coords: Coordinate[]) => void) => {
    const map = mapApiRef.value?.mapInstance.value
    const source = mapApiRef.value?.drawSource
    if (!map || !source) {
      console.error('Рисование не может быть начато: карта или источник для рисования не готовы.')
      return
    }

    // Гарантированно останавливаем любое предыдущее рисование
    stopDrawing()

    // Отключаем другие взаимодействия, чтобы избежать конфликтов
    mapApiRef.value?.modifyInteraction.setActive(false)
    isDrawing.value = true

    drawInteraction = new Draw({
      source,
      type: 'LineString',
      freehand: true,
    })

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry()
      if (geometry) {
        const coordinates = (geometry as LineString).getCoordinates()
        const lonLatCoordinates = coordinates.map(coord =>
          toLonLat(coord),
        ) as Coordinate[]
        onDrawEnd(lonLatCoordinates)
      }
      source.clear()
    })

    map.addInteraction(drawInteraction)
  }

  return {
    isDrawing,
    startDrawing,
    stopDrawing,
  }
}
