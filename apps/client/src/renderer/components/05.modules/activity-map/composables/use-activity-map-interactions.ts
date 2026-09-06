import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Ref } from 'vue'
import type { ActivityItem } from '../ui/activity-map.vue'
import type { MapMarker } from '~/components/01.kit/kit-map'
import * as maplibregl from 'maplibre-gl'
import { onUnmounted, ref, shallowRef, watch } from 'vue'

interface UseActivityMapInteractionsOptions {
  hoverPopupRef: Ref<HTMLElement | null>
  markers: Ref<MapMarker[]>
}

export function useActivityMapInteractions(options: UseActivityMapInteractionsOptions) {
  const { hoverPopupRef, markers } = options

  const mapInstance = shallowRef<MapLibreMap | null>(null)
  let hoverPopup: maplibregl.Popup | null = null
  const hoveredActivity = ref<ActivityItem | null>(null)
  const isTooltipHovered = ref(false)

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null
  const markersMap = new Map<string, maplibregl.Marker>()

  function getStatusColor(status: ActivityItem['status']) {
    switch (status) {
      case 'active':
        return '#F43F5E' // Красный (Идет сейчас)
      case 'upcoming':
        return '#3B82F6' // Синий (Ожидается)
      case 'past':
        return '#9CA3AF' // Серый (Прошло)
      case 'static':
        return '#10B981' // Зеленый (Статика/Место)
      default:
        return '#3B82F6'
    }
  }

  function syncMarkers() {
    const map = mapInstance.value
    if (!map)
      return

    const currentIds = new Set(markers.value.map(m => m.id))
    markersMap.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        markersMap.delete(id)
      }
    })

    markers.value.forEach((marker) => {
      const payload = marker.payload as ActivityItem | undefined
      const existing = markersMap.get(marker.id)

      if (existing) {
        existing.setLngLat([marker.coords.lon, marker.coords.lat])
        return
      }

      const color = payload ? getStatusColor(payload.status) : '#3B82F6'
      const isStatic = payload?.isStatic ?? true

      const el = document.createElement('div')
      el.className = 'activity-map-marker'
      el.style.cursor = 'pointer'

      if (isStatic) {
        el.innerHTML = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: block;">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="2.8" fill="white"/>
          </svg>
        `
      }
      else {
        el.innerHTML = `
          <div style="
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: ${color};
            border: 2.5px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          "></div>
        `
      }

      el.addEventListener('mouseenter', () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
          hoverTimeout = null
        }
        hoveredActivity.value = payload ?? null

        if (hoverPopupRef.value) {
          if (!hoverPopup) {
            hoverPopup = new maplibregl.Popup({
              offset: isStatic ? 28 : 14,
              closeButton: false,
              closeOnClick: false,
              className: 'activity-hover-popup',
            }).setDOMContent(hoverPopupRef.value)
          }
          hoverPopup.setLngLat([marker.coords.lon, marker.coords.lat]).addTo(map)
        }
      })

      el.addEventListener('mouseleave', () => {
        startCloseTimeout()
      })

      const markerInstance = new maplibregl.Marker({
        element: el,
        anchor: isStatic ? 'bottom' : 'center',
      })
        .setLngLat([marker.coords.lon, marker.coords.lat])
        .addTo(map)

      markersMap.set(marker.id, markerInstance)
    })
  }

  function clearHoverState() {
    if (hoverPopup) {
      hoverPopup.remove()
    }
    hoveredActivity.value = null
  }

  function startCloseTimeout() {
    if (hoverTimeout)
      clearTimeout(hoverTimeout)
    hoverTimeout = setTimeout(() => {
      if (!isTooltipHovered.value)
        clearHoverState()
    }, 300)
  }

  function onTooltipMouseEnter() {
    isTooltipHovered.value = true
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
  }

  function onTooltipMouseLeave() {
    isTooltipHovered.value = false
    startCloseTimeout()
  }

  function initializeInteractions(map: MapLibreMap) {
    mapInstance.value = map
    syncMarkers()
  }

  function focusOnLocation(coords: [number, number], zoom = 14) {
    if (!mapInstance.value)
      return
    mapInstance.value.flyTo({ center: coords, zoom, duration: 500 })
  }

  watch(markers, syncMarkers, { deep: true })

  onUnmounted(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
    markersMap.forEach(m => m.remove())
    markersMap.clear()
    if (hoverPopup) {
      hoverPopup.remove()
      hoverPopup = null
    }
  })

  return {
    hoveredActivity,
    initializeInteractions,
    onTooltipMouseEnter,
    onTooltipMouseLeave,
    focusOnLocation,
  }
}
