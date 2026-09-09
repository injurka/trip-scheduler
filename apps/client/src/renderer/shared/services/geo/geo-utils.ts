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
  pointType?: 'start' | 'via' | 'end' | 'connect' | 'poi'
  label?: string
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
    pointType,
  } = options

  const isConnectPoint = isConnect || pointType === 'connect'
  const container = document.createElement('div')
  container.className = isConnectPoint ? 'maplibre-marker-connect' : 'maplibre-marker-pin'
  container.classList.add(`is-${pointType || (isConnectPoint ? 'connect' : 'poi')}`)
  container.style.cursor = 'pointer'
  container.style.opacity = String(opacity)
  container.style.zIndex = String(zIndex)
  container.style.transition = 'none'

  if (isConnectPoint) {
    container.innerHTML = `
      <div class="connect-marker-inner" style="
        width: ${Math.round(13 * scale)}px;
        height: ${Math.round(13 * scale)}px;
        border-radius: 50%;
        background-color: #ffffff;
        border: ${Math.max(2, Math.round(2.5 * scale))}px solid ${color};
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      "></div>
    `
  }
  else {
    let svgHtml = ''
    if (pointType === 'start') {
      const width = Math.round(28 * scale)
      const height = Math.round(28 * scale)
      svgHtml = `
        <svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#2ECC71" stroke="#ffffff" stroke-width="1.3"/>
          <circle cx="12" cy="9" r="4.2" fill="#ffffff"/>
          <text x="12" y="11.8" font-size="7.5" font-weight="900" fill="#2ECC71" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">A</text>
        </svg>
      `
    }
    else if (pointType === 'end') {
      const width = Math.round(28 * scale)
      const height = Math.round(28 * scale)
      svgHtml = `
        <svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#E74C3C" stroke="#ffffff" stroke-width="1.3"/>
          <circle cx="12" cy="9" r="4.2" fill="#ffffff"/>
          <text x="12" y="11.8" font-size="7.5" font-weight="900" fill="#E74C3C" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">B</text>
        </svg>
      `
    }
    else if (pointType === 'via') {
      const width = Math.round(24 * scale)
      const height = Math.round(24 * scale)
      svgHtml = `
        <svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="3.2" fill="#ffffff"/>
        </svg>
      `
    }
    else {
      const width = Math.round(26 * scale)
      const height = Math.round(26 * scale)
      svgHtml = `
        <svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
        </svg>
      `
    }
    container.innerHTML = `<div class="marker-pin-inner">${svgHtml}</div>`
  }

  return container
}

/**
 * Совместимость с компонентами, использующими старый вызов createMarkerStyle
 */
export function createMarkerStyle(options: MarkerStyleOptions = {}) {
  return options
}
