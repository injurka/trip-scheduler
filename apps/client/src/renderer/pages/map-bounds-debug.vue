<script setup lang="ts">
import type { Map as OlMap } from 'ol'
import type { MapMarker } from '~/components/01.kit/kit-map'
import { toLonLat } from 'ol/proj'
import { KitMap } from '~/components/01.kit/kit-map'

const debugData = ref<any>({})
const mapMarkers = ref<MapMarker[]>([])
const center = ref<[number, number]>([37.6176, 55.7558])

function updateBounds(map: OlMap) {
  const view = map.getView()
  const mapSize = map.getSize()

  if (!mapSize)
    return

  const extent = view.calculateExtent(mapSize)

  const bottomLeftProjected = [extent[0], extent[1]]
  const topRightProjected = [extent[2], extent[3]]
  const topLeftProjected = [extent[0], extent[3]]
  const bottomRightProjected = [extent[2], extent[1]]

  const centerLL = toLonLat(view.getCenter() as [number, number])
  const topLeftLL = toLonLat(topLeftProjected)
  const bottomRightLL = toLonLat(bottomRightProjected)
  const bottomLeftLL = toLonLat(bottomLeftProjected)
  const topRightLL = toLonLat(topRightProjected)

  debugData.value = {
    screen: {
      width: mapSize[0],
      height: mapSize[1],
      zoom: view.getZoom(),
    },
    center: {
      lat: centerLL[1],
      lng: centerLL[0],
      type: 'wgs84',
    },
    leftBottom: {
      lat: bottomLeftLL[1],
      lng: bottomLeftLL[0],
      type: 'wgs84',
    },
    rightTop: {
      lat: topRightLL[1],
      lng: topRightLL[0],
      type: 'wgs84',
    },
    leftTop: {
      lat: topLeftLL[1],
      lng: topLeftLL[0],
      type: 'wgs84',
    },
    rightBottom: {
      lat: bottomRightLL[1],
      lng: bottomRightLL[0],
      type: 'wgs84',
    },
  }

  mapMarkers.value = [
    {
      id: 'top-left',
      coords: { lat: topLeftLL[1], lon: topLeftLL[0] },
      payload: { title: 'Left Top' },
    },
    {
      id: 'bottom-right',
      coords: { lat: bottomRightLL[1], lon: bottomRightLL[0] },
      payload: { title: 'Right Bottom' },
    },
    {
      id: 'center',
      coords: { lat: centerLL[1], lon: centerLL[0] },
      payload: { title: 'Center' },
    },
  ]
}

function onMapReady(map: OlMap) {
  updateBounds(map)

  map.on('moveend', () => {
    updateBounds(map)
  })
}
</script>

<template>
  <div class="debug-page">
    <div class="map-wrapper">
      <KitMap
        :center="center"
        :zoom="10"
        height="100%"
        width="100%"
        :markers="mapMarkers"
        :fit-on-markers-update="false"
        @map-ready="onMapReady"
      />

      <div class="corner-marker top-left" />
      <div class="corner-marker bottom-right" />
    </div>

    <div class="debug-panel">
      <h3>Debug Info</h3>
      <pre>{{ JSON.stringify(debugData, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped lang="scss">
.debug-page {
  display: grid;
  grid-template-columns: 1fr 350px;
  height: 100vh;
  width: 100vw;
  overflow: hidden;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 300px;
  }
}

.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.debug-panel {
  background-color: #1e1f20;
  color: #00ff00;
  padding: 16px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
  border-left: 1px solid #333;

  h3 {
    color: #fff;
    margin-top: 0;
  }

  pre {
    white-space: pre-wrap;
    word-break: break-all;
  }
}

// Уголки для сверки
.corner-marker {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid red;
  z-index: 1000;
  pointer-events: none;

  &.top-left {
    top: 0;
    left: 0;
    border-right: none;
    border-bottom: none;
  }

  &.bottom-right {
    bottom: 0;
    right: 0;
    border-left: none;
    border-top: none;
  }
}
</style>
