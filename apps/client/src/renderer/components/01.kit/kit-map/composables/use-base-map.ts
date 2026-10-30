import type {
  FitBoundsOptions,
  LngLatBoundsLike,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl'
import type { Ref } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { onUnmounted, readonly, ref, shallowRef } from 'vue'
import { applyTerrain, ensureMaplibreWorkerReady, getMapStyle, OSM_STYLE } from '~/shared/lib/map-styles-sources'
import { getMaplibreTransformRequest, mapTileCacheManager } from '~/shared/lib/map-tile-cache'
import { isValidCoordinate } from '~/shared/services/geo'

export interface BaseMapOptions {
  container: HTMLElement | string
  center: [number, number]
  zoom?: number
  minZoom?: number
  maxZoom?: number
  pitch?: number
  maxPitch?: number
  bearing?: number
  style?: string | StyleSpecification
  showAttribution?: boolean
  interactive?: boolean
  rotateSensitivity?: number
  pitchSensitivity?: number
  bounds?: LngLatBoundsLike
  fitBoundsOptions?: FitBoundsOptions
}

export type StyleLoadCallback = (map: MapLibreMap) => void

function setInteractionHandlerState(handler: { enable: () => void, disable: () => void } | undefined, enabled: boolean) {
  if (!handler)
    return

  if (enabled)
    handler.enable()
  else
    handler.disable()
}

function normalizeBounds(bounds: LngLatBoundsLike | [number, number, number, number]): LngLatBoundsLike {
  const isNumericExtent = Array.isArray(bounds)
    && bounds.length === 4
    && bounds.every(value => typeof value === 'number')

  if (isNumericExtent) {
    const [west, south, east, north] = bounds as [number, number, number, number]

    return [[west, south], [east, north]]
  }

  return bounds as LngLatBoundsLike
}

function getFitExtentPadding(padding?: number[] | number) {
  if (typeof padding === 'number')
    return padding

  if (Array.isArray(padding)) {
    return {
      top: padding[0] ?? 50,
      right: padding[1] ?? 50,
      bottom: padding[2] ?? 50,
      left: padding[3] ?? 50,
    }
  }

  return 50
}

function normalizeCenter(center: [number, number]): [number, number] {
  let [lng, lat] = center

  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90)
    [lng, lat] = [lat, lng]

  return isValidCoordinate([lng, lat]) ? [lng, lat] : [37.6173, 55.7558]
}

function createMapOptions(
  container: HTMLElement,
  options: BaseMapOptions,
  style: string | StyleSpecification,
  zoom: number,
): maplibregl.MapOptions {
  return {
    container,
    style,
    center: normalizeCenter(options.center),
    zoom,
    minZoom: options.minZoom ?? 2,
    maxZoom: options.maxZoom ?? 22,
    pitch: options.pitch ?? 0,
    maxPitch: options.maxPitch ?? 60,
    bearing: options.bearing ?? 0,
    interactive: true,
    dragRotate: true,
    pitchWithRotate: true,
    aroundCenter: false,
    rotateSpeed: 0.8 * (options.rotateSensitivity ?? 0.4),
    pitchSpeed: -0.5 * (options.pitchSensitivity ?? 0.4),
    attributionControl: options.showAttribution === false ? false : undefined,
    ...getOptionalMapOptions(options),
  }
}

function getOptionalMapOptions(options: BaseMapOptions): Partial<maplibregl.MapOptions> {
  const transformRequest = getMaplibreTransformRequest()
  const mapOptions: Partial<maplibregl.MapOptions> = {}

  if (transformRequest)
    mapOptions.transformRequest = transformRequest

  if (options.bounds) {
    mapOptions.bounds = options.bounds
    mapOptions.fitBoundsOptions = options.fitBoundsOptions ?? { padding: 60, maxZoom: 14.8 }
  }

  return mapOptions
}

function resolveMissingImage(map: maplibregl.Map, id: string) {
  if (!id || map.hasImage(id))
    return

  try {
    map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) }, { sdf: true })
  }
  catch {
    // Игнорируем гонку параллельных запросов на одну и ту же иконку.
  }
}

function registerMissingImageHandlers(map: maplibregl.Map) {
  if (typeof (map as any).setMissingStyleImageResolver === 'function') {
    ; (map as any).setMissingStyleImageResolver((id: string) => resolveMissingImage(map, id))
  }

  map.on('styleimagemissing', (event: any) => {
    if (event?.id)
      resolveMissingImage(map, event.id)
  })
}

function sanitizeSliceExpression(expression: any): any {
  if (!Array.isArray(expression))
    return expression

  if (expression[0] === 'slice' && Array.isArray(expression[1]) && expression[1][0] === 'get') {
    return ['slice', ['coalesce', expression[1], ''], ...expression.slice(2).map(sanitizeSliceExpression)]
  }

  return expression.map(sanitizeSliceExpression)
}

function sanitizeRoadShieldColors(map: maplibregl.Map) {
  try {
    if (!map.getLayer('Road shields'))
      return

    const colorProperties = ['icon-color', 'icon-halo-color'] as const

    colorProperties.forEach((property) => {
      const expression = map.getPaintProperty('Road shields', property)

      if (expression)
        map.setPaintProperty('Road shields', property, sanitizeSliceExpression(expression))
    })
  }
  catch {
    // Игнорируем ошибки при отсутствии слоя в кастомных стилях.
  }
}

function registerStyleLoadHandler(map: maplibregl.Map, callbacks: Set<StyleLoadCallback>, onReady: () => void) {
  map.on('style.load', () => {
    applyTerrain(map)
    sanitizeRoadShieldColors(map)
    callbacks.forEach((callback) => {
      try {
        callback(map)
      }
      catch (error) {
        console.error('[useBaseMap] Ошибка в style.load колбэке:', error)
      }
    })
    onReady()
  })
}

function updateZoomClasses(map: maplibregl.Map, fallbackContainer: HTMLElement, zoom: number) {
  const container = map.getContainer() || fallbackContainer

  if (!container.classList)
    return

  container.classList.toggle('map-zoom-micro', zoom < 9.5)
  container.classList.toggle('map-zoom-far', zoom >= 9.5 && zoom < 11.5)
  container.classList.toggle('map-zoom-mid', zoom >= 11.5 && zoom < 14)
  container.classList.toggle('map-zoom-close', zoom >= 14)
}

function isStyleLoadError(event: any): boolean {
  const errorStatus = event?.error?.status

  return event?.dataType === 'style' || [401, 403, 404].includes(errorStatus)
}

function shouldUseOsmFallback(
  event: any,
  map: maplibregl.Map,
  isReady: boolean,
  initialStyle: string | StyleSpecification,
  alreadyRetried: boolean,
): boolean {
  return isStyleLoadError(event)
    && !isReady
    && !map.isStyleLoaded()
    && !alreadyRetried
    && initialStyle !== OSM_STYLE
}

function registerMapErrorHandler(
  map: maplibregl.Map,
  initialStyle: string | StyleSpecification,
  isReady: () => boolean,
  onReady: () => void,
) {
  let hasRetriedWithOsm = false

  map.on('error', (event: any) => {
    console.warn('[useBaseMap] Ошибка MapLibre:', event?.error?.message || event)

    if (!shouldUseOsmFallback(
      event,
      map,
      isReady(),
      initialStyle,
      hasRetriedWithOsm,
    )) {
      return
    }

    hasRetriedWithOsm = true
    console.warn('[useBaseMap] Ошибка загрузки базового стиля, переключаемся на OpenStreetMap fallback')

    try {
      map.setStyle(OSM_STYLE, { diff: false })
    }
    catch (error) {
      console.error('[useBaseMap] Не удалось применить OSM fallback:', error)
      onReady()
    }
  })
}

export function useBaseMap() {
  const mapInstance: Ref<MapLibreMap | null> = shallowRef(null)
  const isMapReady = ref(false)
  const currentZoom = ref(12)

  let resizeObserver: ResizeObserver | null = null
  let loadTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  const styleLoadCallbacks = new Set<StyleLoadCallback>()

  const clearLoadTimeout = () => {
    if (!loadTimeoutTimer)
      return

    clearTimeout(loadTimeoutTimer)
    loadTimeoutTimer = null
  }

  const onStyleLoad = (cb: StyleLoadCallback) => {
    styleLoadCallbacks.add(cb)

    if (isMapReady.value && mapInstance.value) {
      cb(mapInstance.value)
    }

    return () => {
      styleLoadCallbacks.delete(cb)
    }
  }

  const setStyle = (style: string | StyleSpecification, options?: { diff?: boolean }) => {
    if (mapInstance.value) {
      mapInstance.value.setStyle(style, {
        diff: false,
        ...options,
      })
    }
  }

  const setInteractive = (interactive: boolean) => {
    const map = mapInstance.value

    if (!map)
      return

    const handlers = [map.dragPan, map.dragRotate, map.scrollZoom, map.boxZoom, map.keyboard, map.doubleClickZoom, map.touchZoomRotate, map.touchPitch]
    handlers.forEach(handler => setInteractionHandlerState(handler, interactive))
  }

  const zoomIn = (delta = 1, duration = 250) => {
    if (mapInstance.value) {
      mapInstance.value.zoomTo(mapInstance.value.getZoom() + delta, { duration })
    }
  }

  const zoomOut = (delta = 1, duration = 250) => {
    if (mapInstance.value) {
      mapInstance.value.zoomTo(mapInstance.value.getZoom() - delta, { duration })
    }
  }

  const flyTo = (
    lon: number,
    lat: number,
    zoom = 14,
    duration = 700,
  ) => {
    if (mapInstance.value) {
      if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
        const temp = lat
        lat = lon
        lon = temp
      }

      if (!isValidCoordinate([lon, lat]))
        return

      mapInstance.value.flyTo({
        center: [lon, lat],
        zoom,
        duration,
      })
    }
  }

  const fitBounds = (bounds: LngLatBoundsLike | [number, number, number, number], options?: FitBoundsOptions) => {
    if (!mapInstance.value || !bounds)
      return

    const targetBounds = normalizeBounds(bounds)

    try {
      mapInstance.value.fitBounds(targetBounds, {
        padding: options?.padding ?? { top: 60, right: 60, bottom: 60, left: 60 },
        duration: options?.duration !== undefined ? options.duration : 400,
        maxZoom: options?.maxZoom ?? 14.8,
      })
    }
    catch (e) {
      console.warn('fitBounds skipped:', e)
    }
  }

  const fitExtent = (extent?: [number, number, number, number] | null, options?: { padding?: number[] | number, duration?: number, maxZoom?: number }) => {
    if (!extent)
      return

    const padding = getFitExtentPadding(options?.padding)

    fitBounds(extent, {
      padding,
      duration: options?.duration ?? 500,
      maxZoom: options?.maxZoom ?? 14.8,
    })
  }

  const resize = () => {
    mapInstance.value?.resize()
  }

  const updateSize = () => {
    resize()
  }

  const destroyMap = () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (loadTimeoutTimer) {
      clearTimeout(loadTimeoutTimer)
      loadTimeoutTimer = null
    }

    styleLoadCallbacks.clear()

    if (mapInstance.value) {
      mapInstance.value.remove()
      mapInstance.value = null
      isMapReady.value = false
      mapTileCacheManager.releaseBlobUrls()
    }
  }

  const initMap = (options: BaseMapOptions): Promise<void> => {
    return new Promise((resolve) => {
      const targetElement
        = typeof options.container === 'string'
          ? document.getElementById(options.container)
          : options.container

      if (!targetElement) {
        console.error('[useBaseMap] Контейнер карты не найден:', options.container)
        resolve()

        return
      }

      const createMapInner = () => {
        try {
          const initialStyle = options.style || getMapStyle('maptilerStreets')
          const initialZoom = options.zoom ?? 12
          currentZoom.value = initialZoom
          const map = new maplibregl.Map(createMapOptions(
            targetElement,
            options,
            initialStyle,
            initialZoom,
          ))
          registerMissingImageHandlers(map)

          targetElement.addEventListener('contextmenu', (e) => {
            const el = e.target as HTMLElement | null

            if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA')
              return

            e.preventDefault()
          })

          let isResolved = false
          const markReady = () => {
            if (isResolved)
              return

            isResolved = true
            clearLoadTimeout()
            isMapReady.value = true
            map.resize()
            resolve()
          }

          registerStyleLoadHandler(map, styleLoadCallbacks, markReady)
          updateZoomClasses(map, targetElement, initialZoom)

          map.on('zoom', () => {
            const z = map.getZoom()
            currentZoom.value = Math.round(z)
            updateZoomClasses(map, targetElement, z)
          })

          map.once('load', markReady)
          registerMapErrorHandler(
            map,
            initialStyle,
            () => isMapReady.value,
            markReady,
          )

          loadTimeoutTimer = setTimeout(() => {
            if (!isMapReady.value) {
              console.warn('[useBaseMap] Таймаут ожидания карты, принудительное завершение инициализации')
              markReady()
            }
          }, 5000)

          mapInstance.value = map

          if (options.interactive === false) {
            setInteractive(false)
          }
        }
        catch (err) {
          console.error('[useBaseMap] Ошибка инициализации MapLibre:', err)

          if (loadTimeoutTimer) {
            clearTimeout(loadTimeoutTimer)
            loadTimeoutTimer = null
          }

          resolve()
        }
      }

      const createMap = () => {
        ensureMaplibreWorkerReady()
          .then(createMapInner)
          .catch((err) => {
            console.error('[useBaseMap] Ошибка ожидания maplibre worker:', err)
            resolve()
          })
      }

      createMap()
      resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(targetElement)
    })
  }

  onUnmounted(destroyMap)

  return {
    mapInstance,
    isMapReady: readonly(isMapReady),
    currentZoom: readonly(currentZoom),
    initMap,
    destroyMap,
    setStyle,
    onStyleLoad,
    zoomIn,
    zoomOut,
    flyTo,
    fitBounds,
    fitExtent,
    resize,
    updateSize,
    setInteractive,
  }
}
