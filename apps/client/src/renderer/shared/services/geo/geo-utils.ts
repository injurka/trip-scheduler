import type { LineString } from 'ol/geom'
import { Point } from 'ol/geom'
import { fromLonLat as olFromLonLat, toLonLat as olToLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Icon as OlIcon, Stroke, Style } from 'ol/style'

// Кеш SVG Data URL для пинов по цвету
const pinIconDataUrlCache = new Map<string, string>()

/**
 * Получить Data URL для SVG-маркера с заданным цветом (с кешированием)
 */
export function getPinIconDataUrl(color: string = '#3498db', innerColor: string = '#ffffff'): string {
  const cacheKey = `${color}::${innerColor}`
  const cached = pinIconDataUrlCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}"/><circle cx="12" cy="9" r="2.5" fill="${innerColor}"/></svg>`
  const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`
  pinIconDataUrlCache.set(cacheKey, dataUrl)
  return dataUrl
}

/**
 * Безопасное преобразование [lon, lat] (EPSG:4326) в OpenLayers [x, y] (EPSG:3857)
 */
export function toMapCoord(coords: [number, number]): [number, number] {
  return olFromLonLat(coords) as [number, number]
}

/**
 * Безопасное преобразование OpenLayers [x, y] (EPSG:3857) в [lon, lat] (EPSG:4326)
 */
export function toLonLatCoord(coords: [number, number]): [number, number] {
  return olToLonLat(coords) as [number, number]
}

/**
 * Профессиональная многослойная стилизация линии маршрута:
 * 1. Нижний слой — обводка (Casing) белого цвета для контраста на любом типе подложки (лес, горы, спутник)
 * 2. Верхний слой — акцентная нить маршрута с поддержкой пунктира для прямых линий
 * 3. Маркер старта (белый с цветным ободком)
 * 4. Маркер финиша (цветной с белым ободком)
 */
export function createRouteStyles(
  lineGeometry: LineString,
  color: string = '#4363D8',
  isDirect: boolean = false,
): Style[] {
  const styles: Style[] = [
    // 1. Нижний слой: контрастная подложка (Casing)
    new Style({
      stroke: new Stroke({
        color: '#ffffff',
        width: 7,
        lineCap: 'round',
        lineJoin: 'round',
      }),
      zIndex: 1,
    }),
    // 2. Верхний слой: основная нить маршрута
    new Style({
      stroke: new Stroke({
        color,
        width: 4,
        lineDash: isDirect ? [8, 8] : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }),
      zIndex: 2,
    }),
  ]

  const firstCoord = lineGeometry.getFirstCoordinate()
  const lastCoord = lineGeometry.getLastCoordinate()

  if (firstCoord) {
    styles.push(
      new Style({
        geometry: new Point(firstCoord),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({
            color,
            width: 3,
          }),
        }),
        zIndex: 3,
      }),
    )
  }

  if (lastCoord) {
    styles.push(
      new Style({
        geometry: new Point(lastCoord),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 3,
          }),
        }),
        zIndex: 3,
      }),
    )
  }

  return styles
}

export interface MarkerStyleOptions {
  color?: string
  scale?: number
  opacity?: number
  zIndex?: number
  isConnect?: boolean
}

/**
 * Создание стиля маркера с оптимизированным кешированием иконки
 */
export function createMarkerStyle(options: MarkerStyleOptions = {}): Style {
  const {
    color = '#3498db',
    scale = 1.5,
    opacity = 1.0,
    zIndex = 20,
    isConnect = false,
  } = options

  if (isConnect) {
    return new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({
          color,
          width: 2,
        }),
      }),
      zIndex,
    })
  }

  return new Style({
    image: new OlIcon({
      src: getPinIconDataUrl(color),
      scale,
      anchor: [0.5, 1],
      opacity,
    }),
    zIndex,
  })
}
