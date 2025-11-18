import type { EActivitySectionType } from '~/shared/types/models/activity'

/**
 * Координаты в формате [долгота, широта].
 * Стандарт для GeoJSON и OpenLayers.
 */
export type Coordinate = [number, number]

/**
 * Тип точки на карте.
 * - `poi`: Point of Interest - обычная точка интереса.
 * - `start`: Начальная точка маршрута.
 * - `via`: Промежуточная точка маршрута.
 * - `end`: Конечная точка маршрута.
 */
export type PointType = 'poi' | 'start' | 'via' | 'end'

/**
 * Стиль для маркера на карте.
 * Позволяет гибко настраивать внешний вид.
 */
export interface MarkerStyle {
  iconUrl?: string // URL для кастомной иконки (SVG или PNG).
  color?: string // Цвет заливки для стандартной иконки, если iconUrl не указан.
  scale?: number // Масштаб иконки.
}

/**
 * Основной интерфейс для представления точки (маркера) на карте.
 */
export interface MapPoint {
  id: string // Уникальный идентификатор точки.
  coordinates: Coordinate // Координаты точки.
  type: PointType // Тип точки для стилизации и логики.
  style?: MarkerStyle // Индивидуальные стили для маркера.
  address?: string
  comment?: string // Комментарий который будет отображен над маркером
}

/**
 * Интерфейс для маршрута.
 */
export interface MapRoute {
  id: string // Уникальный идентификатор маршрута
  title: string // Название маршрута, по умолчанию "Маршрут-<index>"
  points: MapPoint[] // Точки маршрута
  color?: string // Цвет линии маршрута
  distance?: number // Общее расстояние в метрах (Первоначально расчитывается после запроса API, а после его можно будет изменить самостоятельно)
  duration?: number // Общее время в секундах
  geometry?: Coordinate[] // Геометрия маршрута для отображения на карте
  isVisible: boolean // Видимость маршрута на карте
  isFetching?: boolean // Флаг для отображения состояния загрузки маршрута
  isDirect?: boolean // Флаг для отображения маршрута в виде прямой пунктирной линии
}

/**
 * Интерфейс для нарисованного от руки маршрута
 */
export interface DrawnRoute {
  id: string
  title: string
  segments: Coordinate[][] // Координаты нарисованной линии
  color?: string
  distance?: number // Приблизительное расстояние
  isVisible: boolean
}

export interface ActivitySectionGeolocation {
  // Общие метаданные
  id: string
  type: EActivitySectionType.GEOLOCATION
  isAttached?: boolean
  title?: string
  icon?: string

  // Данные связанные с геолокацией
  points: MapPoint[] // Point of Interest - обычные точки интереса
  routes: MapRoute[] // Маршруты
  drawnRoutes: DrawnRoute[] // От руки нарисованные маршруты
  center?: Coordinate // Координаты центра карты
  zoom?: number // Уровень масштабирования карты
}

/**
 * Опции для инициализации карты.
 */
export interface GeolocationMapOptions {
  container: string | HTMLElement
  center: [number, number]
  zoom?: number
  interactive?: boolean
}

/**
 * Ответ от OSRM API
 */
export interface OSRMResponse {
  code: string
  routes: Array<{
    legs: Array<{
      steps: any[]
      weight: number
      summary: string
      duration: number
      distance: number
    }>
    weight_name: string
    weight: number
    duration: number
    distance: number
    geometry: string
  }>
  waypoints: Array<{
    hint: string
    location: [number, number]
    name: string
    distance: number
  }>
}
