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
}

export type StyleLoadCallback = (map: MapLibreMap) => void

export function useBaseMap() {
  const mapInstance: Ref<MapLibreMap | null> = shallowRef(null)
  const isMapReady = ref(false)
  const currentZoom = ref(12)

  let resizeObserver: ResizeObserver | null = null
  let loadTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  const styleLoadCallbacks = new Set<StyleLoadCallback>()

  const onStyleLoad = (cb: StyleLoadCallback) => {
    styleLoadCallbacks.add(cb)
    if (isMapReady.value && mapInstance.value) {
      cb(mapInstance.value)
    }
    return () => {
      styleLoadCallbacks.delete(cb)
    }
  }

  const setStyle = (style: string | StyleSpecification) => {
    if (mapInstance.value) {
      mapInstance.value.setStyle(style)
    }
  }

  const setInteractive = (interactive: boolean) => {
    const map = mapInstance.value
    if (!map)
      return

    if (interactive) {
      map.dragPan?.enable()
      map.dragRotate?.enable()
      map.scrollZoom?.enable()
      map.boxZoom?.enable()
      map.keyboard?.enable()
      map.doubleClickZoom?.enable()
      map.touchZoomRotate?.enable()
      map.touchPitch?.enable?.()
    }
    else {
      map.dragPan?.disable()
      map.dragRotate?.disable()
      map.scrollZoom?.disable()
      map.boxZoom?.disable()
      map.keyboard?.disable()
      map.doubleClickZoom?.disable()
      map.touchZoomRotate?.disable()
      map.touchPitch?.disable?.()
    }
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

  const flyTo = (lon: number, lat: number, zoom = 14, duration = 700) => {
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

  const fitBounds = (
    bounds: LngLatBoundsLike | [number, number, number, number],
    options?: FitBoundsOptions,
  ) => {
    if (!mapInstance.value || !bounds)
      return

    let targetBounds: LngLatBoundsLike
    if (
      Array.isArray(bounds)
      && bounds.length === 4
      && typeof bounds[0] === 'number'
      && typeof bounds[1] === 'number'
      && typeof bounds[2] === 'number'
      && typeof bounds[3] === 'number'
    ) {
      // Преобразование из [minLon, minLat, maxLon, maxLat] в [[minLon, minLat], [maxLon, maxLat]]
      targetBounds = [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ]
    }
    else {
      targetBounds = bounds as LngLatBoundsLike
    }

    mapInstance.value.fitBounds(targetBounds, {
      padding: options?.padding ?? { top: 50, right: 50, bottom: 50, left: 50 },
      duration: options?.duration ?? 500,
      maxZoom: options?.maxZoom ?? 16,
    })
  }

  const fitExtent = (
    extent?: [number, number, number, number] | null,
    options?: { padding?: number[] | number, duration?: number, maxZoom?: number },
  ) => {
    if (!extent)
      return

    const padding
      = typeof options?.padding === 'number'
        ? options.padding
        : Array.isArray(options?.padding)
          ? {
              top: options.padding[0] ?? 50,
              right: options.padding[1] ?? 50,
              bottom: options.padding[2] ?? 50,
              left: options.padding[3] ?? 50,
            }
          : 50

    fitBounds(extent, {
      padding,
      duration: options?.duration ?? 500,
      maxZoom: options?.maxZoom ?? 16,
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

          let safeCenter = options.center
          if (Array.isArray(safeCenter) && safeCenter.length >= 2) {
            let [lng, lat] = safeCenter
            if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
              const temp = lat
              lat = lng
              lng = temp
            }
            if (isValidCoordinate([lng, lat])) {
              safeCenter = [lng, lat]
            }
            else {
              safeCenter = [37.6173, 55.7558]
            }
          }
          else {
            safeCenter = [37.6173, 55.7558]
          }

          const map = new maplibregl.Map({
            container: targetElement,
            style: initialStyle,
            center: safeCenter,
            zoom: initialZoom,
            minZoom: options.minZoom ?? 2,
            maxZoom: options.maxZoom ?? 22,
            pitch: options.pitch ?? 0,
            maxPitch: options.maxPitch ?? 85,
            bearing: options.bearing ?? 0,
            interactive: true,
            dragRotate: true,
            pitchWithRotate: true,
            attributionControl: options.showAttribution === false ? false : undefined,
          })

          // Настройка чувствительности вращения и наклона при зажатой ПКМ / Ctrl+ЛКМ
          const rotateSensitivity = options.rotateSensitivity ?? 0.4
          const pitchSensitivity = options.pitchSensitivity ?? 0.4
          const dragRotateHandler = (map as any).dragRotate
          if (dragRotateHandler?._mouseRotate?._moveFunction) {
            const origRotateMove = dragRotateHandler._mouseRotate._moveFunction.bind(dragRotateHandler._mouseRotate)
            dragRotateHandler._mouseRotate._moveFunction = (...args: any[]) => {
              const res = origRotateMove(...args)
              if (res?.bearingDelta) {
                res.bearingDelta *= rotateSensitivity
              }
              return res
            }
          }
          if (dragRotateHandler?._mousePitch?._moveFunction) {
            const origPitchMove = dragRotateHandler._mousePitch._moveFunction.bind(dragRotateHandler._mousePitch)
            dragRotateHandler._mousePitch._moveFunction = (...args: any[]) => {
              const res = origPitchMove(...args)
              if (res?.pitchDelta) {
                res.pitchDelta *= pitchSensitivity
              }
              return res
            }
          }

          targetElement.addEventListener('contextmenu', (e) => {
            const el = e.target as HTMLElement | null
            if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') {
              return
            }
            e.preventDefault()
          })

          let isResolved = false
          const markReady = () => {
            if (!isResolved) {
              isResolved = true
              if (loadTimeoutTimer) {
                clearTimeout(loadTimeoutTimer)
                loadTimeoutTimer = null
              }
              isMapReady.value = true
              map.resize()
              resolve()
            }
          }

          map.on('style.load', () => {
            applyTerrain(map)
            styleLoadCallbacks.forEach((cb) => {
              try {
                cb(map)
              }
              catch (e) {
                console.error('[useBaseMap] Ошибка в style.load колбэке:', e)
              }
            })
            markReady()
          })

          map.on('zoom', () => {
            currentZoom.value = Math.round(map.getZoom())
          })

          map.once('load', markReady)

          let hasRetriedWithOsm = false
          map.on('error', (e: any) => {
            console.warn('[useBaseMap] Ошибка MapLibre:', e?.error?.message || e)
            const isStyleLoadError
              = e?.dataType === 'style'
                || (e?.error && (e.error.status === 401 || e.error.status === 403 || e.error.status === 404))
            if (
              isStyleLoadError
              && !isMapReady.value
              && !map.isStyleLoaded()
              && !hasRetriedWithOsm
              && initialStyle !== OSM_STYLE
            ) {
              hasRetriedWithOsm = true
              console.warn('[useBaseMap] Ошибка загрузки базового стиля, переключаемся на OpenStreetMap fallback')
              try {
                map.setStyle(OSM_STYLE)
              }
              catch (err) {
                console.error('[useBaseMap] Не удалось применить OSM fallback:', err)
                markReady()
              }
            }
          })

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

      // В Tauri Android workerUrl ставится асинхронно (fetch → blob) — ждём до создания карты
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
