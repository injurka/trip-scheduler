import type { Overlay } from 'ol'
import type { Control } from 'ol/control'
import type { Extent } from 'ol/extent'
import type { Interaction } from 'ol/interaction'
import type BaseLayer from 'ol/layer/Base'
import type TileSource from 'ol/source/Tile'
import type { Ref } from 'vue'
import { Map as OlMap, View } from 'ol'
import { Attribution, defaults as defaultControls } from 'ol/control'
import TileLayer from 'ol/layer/Tile'
import { fromLonLat } from 'ol/proj'
import OSM from 'ol/source/OSM'
import { onUnmounted, readonly, ref, shallowRef } from 'vue'

export interface BaseMapOptions {
  container: HTMLElement | string
  center: [number, number]
  zoom?: number
  minZoom?: number
  maxZoom?: number
  initialSource?: TileSource
  extraLayers?: BaseLayer[]
  extraOverlays?: Overlay[]
  extraInteractions?: Interaction[]
  controls?: Control[]
  showAttribution?: boolean
}

export function useBaseMap() {
  const mapInstance: Ref<OlMap | null> = shallowRef(null)
  const isMapReady = ref(false)
  const currentZoom = ref(12)
  const tileLayerRef = shallowRef<TileLayer<TileSource> | null>(null)

  let resizeObserver: ResizeObserver | null = null

  const setTileSource = (source: TileSource) => {
    if (tileLayerRef.value) {
      tileLayerRef.value.setSource(source)
    }
  }

  const zoomIn = (delta = 1, duration = 250) => {
    const view = mapInstance.value?.getView()
    if (view) {
      const z = view.getZoom() ?? 12
      view.animate({ zoom: z + delta, duration })
    }
  }

  const zoomOut = (delta = 1, duration = 250) => {
    const view = mapInstance.value?.getView()
    if (view) {
      const z = view.getZoom() ?? 12
      view.animate({ zoom: z - delta, duration })
    }
  }

  const flyTo = (lon: number, lat: number, zoom = 14, duration = 700) => {
    const view = mapInstance.value?.getView()
    if (view) {
      view.animate({
        center: fromLonLat([lon, lat]),
        zoom,
        duration,
      })
    }
  }

  const fitExtent = (extent?: Extent | null, options?: { padding?: number[], duration?: number, maxZoom?: number }) => {
    if (!extent)
      return
    const view = mapInstance.value?.getView()
    if (view) {
      view.fit(extent, {
        padding: options?.padding || [50, 50, 50, 50],
        duration: options?.duration || 500,
        maxZoom: options?.maxZoom || 15,
      })
    }
  }

  const updateSize = () => {
    mapInstance.value?.updateSize()
  }

  const destroyMap = () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (mapInstance.value) {
      mapInstance.value.setTarget(undefined)
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

      const createMap = () => {
        try {
          const initialSource = options.initialSource || new OSM({ crossOrigin: 'anonymous' })
          tileLayerRef.value = new TileLayer({ source: initialSource })

          const layers: BaseLayer[] = [tileLayerRef.value, ...(options.extraLayers || [])]

          const initialZoom = options.zoom || 12
          currentZoom.value = initialZoom

          const view = new View({
            center: fromLonLat(options.center),
            zoom: initialZoom,
            minZoom: options.minZoom || 2,
            maxZoom: options.maxZoom || 20,
          })

          view.on('change:resolution', () => {
            currentZoom.value = view.getZoom() ?? 12
          })

          const controls = options.controls
            || (options.showAttribution !== false
              ? defaultControls({ zoom: false, rotate: false, attribution: false }).extend([
                  new Attribution({ collapsible: true }),
                ])
              : [])

          const map = new OlMap({
            target: targetElement,
            layers,
            view,
            controls,
            overlays: options.extraOverlays || [],
          })

          if (options.extraInteractions) {
            options.extraInteractions.forEach(interaction => map.addInteraction(interaction))
          }

          mapInstance.value = map

          map.once('postrender', () => {
            isMapReady.value = true
            map.updateSize()
            resolve()
          })
        }
        catch (err) {
          console.error('[useBaseMap] Ошибка инициализации карты:', err)
          resolve()
        }
      }

      if (targetElement.clientWidth > 0 && targetElement.clientHeight > 0) {
        createMap()
        resizeObserver = new ResizeObserver(() => updateSize())
        resizeObserver.observe(targetElement)
      }
      else {
        resizeObserver = new ResizeObserver(() => {
          if (targetElement.clientWidth > 0 && targetElement.clientHeight > 0) {
            if (!mapInstance.value) {
              createMap()
            }
            else {
              updateSize()
            }
          }
        })
        resizeObserver.observe(targetElement)
      }
    })
  }

  onUnmounted(destroyMap)

  return {
    mapInstance,
    isMapReady: readonly(isMapReady),
    currentZoom: readonly(currentZoom),
    tileLayerRef,
    initMap,
    destroyMap,
    setTileSource,
    zoomIn,
    zoomOut,
    flyTo,
    fitExtent,
    updateSize,
  }
}
