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
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isWithinGeoBounds(lng: number, lat: number): boolean {
  return lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
}

export function isValidCoordinate(coords: unknown): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length < 2)
    return false

  const [lng, lat] = coords as unknown[]

  return (
    isFiniteNumber(lng)
    && isFiniteNumber(lat)
    && isWithinGeoBounds(lng, lat)
  )
}

/**
 * Вычисляет Bounding Box для набора точек и маршрутов.
 * Возвращает null, если точек нет, меньше двух или все координаты совпадают.
 */
export function computeBoundingBox(points?: Array<{ coordinates?: [number, number] }>, routes?: Array<{ points?: Array<{ coordinates?: [number, number] }>, geometry?: [number, number][] }>, marginRatio = 0.10): [[number, number], [number, number]] | null {
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  const consider = (coord?: [number, number] | null) => {
    if (!coord || !isValidCoordinate(coord))
      return

    const [lng, lat] = coord

    if (lng < minLng)
      minLng = lng

    if (lng > maxLng)
      maxLng = lng

    if (lat < minLat)
      minLat = lat

    if (lat > maxLat)
      maxLat = lat
  }

  points?.forEach(p => consider(p.coordinates))
  routes?.forEach((r) => {
    if (Array.isArray(r.geometry) && r.geometry.length > 0) {
      r.geometry.forEach(c => consider(c))
    }
    else if (Array.isArray(r.points) && r.points.length > 0) {
      r.points.forEach(p => consider(p.coordinates))
    }
  })

  if (minLng === Number.POSITIVE_INFINITY || minLat === Number.POSITIVE_INFINITY)
    return null

  if (minLng === maxLng && minLat === maxLat)
    return null

  const dLng = maxLng - minLng
  const dLat = maxLat - minLat

  return [
    [minLng - dLng * marginRatio, Math.max(-85, minLat - dLat * marginRatio)],
    [maxLng + dLng * marginRatio, Math.min(85, maxLat + dLat * marginRatio)],
  ]
}

export interface MarkerStyleOptions {
  color?: string
  scale?: number
  opacity?: number
  zIndex?: number
  shape?: 'pin' | 'circle'
  isConnect?: boolean
  pointType?: 'start' | 'via' | 'end' | 'connect' | 'poi'
  label?: string
}

function addCircleMarkerLabel(container: HTMLElement, label: string): void {
  const element = document.createElement('span')
  element.className = 'station-label'
  element.textContent = label
  container.append(element)
  container.tabIndex = 0
  container.setAttribute('role', 'img')
  container.setAttribute('aria-label', label)
}

function createConnectMarkerHtml(color: string, scale: number): string {
  return `
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

function createEndpointMarkerSvg(color: string, scale: number, label: string): string {
  const size = Math.round(28 * scale)

  return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.3"/>
          <circle cx="12" cy="9" r="4.2" fill="#ffffff"/>
          <text x="12" y="11.8" font-size="7.5" font-weight="900" fill="${color}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${label}</text>
        </svg>
      `
}

function createViaMarkerSvg(color: string, scale: number): string {
  const size = Math.round(24 * scale)

  return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="3.2" fill="#ffffff"/>
        </svg>
      `
}

function createPoiMarkerSvg(color: string, scale: number): string {
  const size = Math.round(26 * scale)

  return `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
        </svg>
      `
}

function createPinMarkerSvg(pointType: MarkerStyleOptions['pointType'], color: string, scale: number): string {
  if (pointType === 'start')
    return createEndpointMarkerSvg('#2ECC71', scale, 'A')

  if (pointType === 'end')
    return createEndpointMarkerSvg('#E74C3C', scale, 'B')

  if (pointType === 'via')
    return createViaMarkerSvg(color, scale)

  return createPoiMarkerSvg(color, scale)
}

function setCircleMarkerStyle(
  container: HTMLElement,
  color: string,
  scale: number,
  label?: string,
): void {
  container.style.setProperty('--marker-color', color)
  container.style.setProperty('--marker-size', `${Math.round(10 * scale)}px`)

  if (label)
    addCircleMarkerLabel(container, label)
}

interface ResolvedMarkerOptions {
  color: string
  scale: number
  opacity: number
  zIndex: number
  shape: 'pin' | 'circle'
  isConnect: boolean
  pointType?: MarkerStyleOptions['pointType']
  label?: string
}

function resolveMarkerOptions(options: MarkerStyleOptions): ResolvedMarkerOptions {
  return {
    color: options.color ?? '#3498db',
    scale: options.scale ?? 1.0,
    opacity: options.opacity ?? 1.0,
    zIndex: options.zIndex ?? 20,
    shape: options.shape ?? 'pin',
    isConnect: options.isConnect ?? false,
    pointType: options.pointType,
    label: options.label,
  }
}

/**
 * Создает нативный DOM-элемент для HTML-маркера MapLibre
 */
export function createMarkerElement(options: MarkerStyleOptions = {}): HTMLElement {
  const {
    color,
    scale,
    opacity,
    zIndex,
    shape,
    isConnect,
    pointType,
  } = resolveMarkerOptions(options)

  const isConnectPoint = isConnect || pointType === 'connect'
  const container = document.createElement('div')
  container.className = isConnectPoint ? 'maplibre-marker-connect' : `maplibre-marker-${shape}`
  container.classList.add(`is-${pointType || (isConnectPoint ? 'connect' : 'poi')}`)
  container.style.cursor = 'pointer'
  container.style.opacity = String(opacity)
  container.style.zIndex = String(zIndex)
  container.style.transition = 'none'

  if (shape === 'circle' && !isConnectPoint) {
    setCircleMarkerStyle(
      container,
      color,
      scale,
      options.label,
    )
  }
  else if (isConnectPoint) {
    container.innerHTML = createConnectMarkerHtml(color, scale)
  }
  else {
    container.innerHTML = `<div class="marker-pin-inner">${createPinMarkerSvg(pointType, color, scale)}</div>`
  }

  return container
}

/**
 * Совместимость с компонентами, использующими старый вызов createMarkerStyle
 */
export function createMarkerStyle(options: MarkerStyleOptions = {}) {
  return options
}
