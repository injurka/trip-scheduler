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
 * Преобразование координат для карты. В MapLibre координаты нативно [lng, lat] (WGS84).
 */
export function toMapCoord(coords: [number, number]): [number, number] {
  return [coords[0], coords[1]]
}

/**
 * Преобразование координат карты в [lon, lat] (WGS84).
 */
export function toLonLatCoord(coords: [number, number]): [number, number] {
  return [coords[0], coords[1]]
}

/**
 * Проверка валидности географических координат [lng, lat] (WGS84)
 */
export function isValidCoordinate(coords: any): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length < 2)
    return false
  const [lng, lat] = coords
  return (
    typeof lng === 'number'
    && typeof lat === 'number'
    && !Number.isNaN(lng)
    && !Number.isNaN(lat)
    && Number.isFinite(lng)
    && Number.isFinite(lat)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
  )
}

export interface MarkerStyleOptions {
  color?: string
  scale?: number
  opacity?: number
  zIndex?: number
  isConnect?: boolean
}

/**
 * Создает нативный DOM-элемент для HTML-маркера MapLibre
 */
export function createMarkerElement(options: MarkerStyleOptions = {}): HTMLElement {
  const {
    color = '#3498db',
    scale = 1.0,
    opacity = 1.0,
    zIndex = 20,
    isConnect = false,
  } = options

  const container = document.createElement('div')
  container.className = isConnect ? 'maplibre-marker-connect' : 'maplibre-marker-pin'
  container.style.cursor = 'pointer'
  container.style.opacity = String(opacity)
  container.style.zIndex = String(zIndex)

  if (isConnect) {
    container.innerHTML = `
      <div style="
        width: ${Math.round(12 * scale)}px;
        height: ${Math.round(12 * scale)}px;
        border-radius: 50%;
        background-color: #ffffff;
        border: ${Math.max(2, Math.round(2.5 * scale))}px solid ${color};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
        transition: transform 0.15s ease;
      "></div>
    `
  }
  else {
    const width = Math.round(26 * scale)
    const height = Math.round(26 * scale)
    container.innerHTML = `
      <svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35)); transition: transform 0.15s ease;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
        <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
      </svg>
    `
  }

  return container
}

/**
 * Совместимость с компонентами, использующими старый вызов createMarkerStyle
 */
export function createMarkerStyle(options: MarkerStyleOptions = {}) {
  return options
}
