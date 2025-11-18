<script setup lang="ts">
import type { Map as OlMap } from 'ol'
import type { Place } from '~/shared/types/models/place'
import { Feature, Overlay } from 'ol'
import { Point } from 'ol/geom'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import VectorSource from 'ol/source/Vector'
import { Icon as OlIcon, Style } from 'ol/style'
import { KitMap } from '~/components/01.kit/kit-map'

const props = defineProps<{
  places: Place[]
  center: [number, number]
}>()

const mapInstance = shallowRef<OlMap | null>(null)
const popupOverlay = shallowRef<Overlay | null>(null)

const markerSource = new VectorSource()
const popupRef = ref<HTMLElement | null>(null)
const selectedPlace = ref<Place | null>(null)

const markerLayer = new VectorLayer({
  source: markerSource,
  zIndex: 10,
})

function createMarkerStyle() {
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#344079"/><circle cx="12" cy="9" r="2.5" fill="white"/></svg>`
  return new Style({
    image: new OlIcon({
      src: `data:image/svg+xml;base64,${btoa(svg)}`,
      scale: 1.5,
      anchor: [0.5, 1],
    }),
  })
}

function updateMarkers(places: Place[]) {
  markerSource.clear()
  if (!places || places.length === 0)
    return

  const style = createMarkerStyle()
  places.forEach((place) => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([place.coordinates.lon, place.coordinates.lat])),
    })
    feature.set('placeData', place)
    feature.setStyle(style)
    markerSource.addFeature(feature)
  })
}

function onMapReady(map: OlMap) {
  mapInstance.value = map
  mapInstance.value.addLayer(markerLayer)

  popupOverlay.value = new Overlay({
    element: popupRef.value!,
    autoPan: {
      animation: { duration: 250 },
    },
  })

  if (popupOverlay.value) {
    mapInstance.value.addOverlay(popupOverlay.value)
  }

  mapInstance.value.on('click', (event) => {
    const feature = map.forEachFeatureAtPixel(event.pixel, f => f)
    if (feature) {
      const placeData = feature.get('placeData') as Place
      selectedPlace.value = placeData
      const coordinates = (feature.getGeometry() as Point).getCoordinates()
      popupOverlay.value?.setPosition(coordinates)
    }
    else {
      selectedPlace.value = null
      popupOverlay.value?.setPosition(undefined)
    }
  })

  updateMarkers(props.places)
}

watch(() => props.places, (newPlaces) => {
  if (mapInstance.value) {
    updateMarkers(newPlaces)
  }
}, { deep: true })

onMounted(() => {
  watch(() => props.places, async () => {
    await nextTick()
    mapInstance.value?.updateSize()
  })
})
</script>

<template>
  <div class="places-map-container">
    <KitMap :center="center" :zoom="10" @map-ready="onMapReady" />
    <div ref="popupRef" class="place-popup">
      <div v-if="selectedPlace" class="popup-content">
        <h4>{{ selectedPlace.name }}</h4>
        <p>{{ selectedPlace.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.places-map-container {
  width: 100%;
  height: 100%;
  min-height: 600px;
  border-radius: var(--r-l);
  overflow: hidden;

  :deep(.kit-map-wrapper) {
    height: 600px !important;
  }
}

.place-popup {
  background-color: var(--bg-secondary-color);
  padding: 1rem;
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-l);
  width: 280px;
  bottom: 12px;
  left: -140px;
  position: absolute;
  transform: translateX(50%);
  transition: opacity 0.2s;

  &:after,
  &:before {
    top: 100%;
    left: 50%;
    border: solid transparent;
    content: ' ';
    height: 0;
    width: 0;
    position: absolute;
    pointer-events: none;
  }
  &:after {
    border-color: rgba(255, 255, 255, 0);
    border-top-color: var(--bg-secondary-color);
    border-width: 10px;
    margin-left: -10px;
  }
  &:before {
    border-color: rgba(0, 0, 0, 0);
    border-top-color: var(--border-primary-color);
    border-width: 11px;
    margin-left: -11px;
  }
}

.popup-content {
  h4 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
  }
}
</style>
