<script setup lang="ts">
import type { MetroSystemDetails } from '../../lib/metro-route'
import type { MetroRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitMap } from '~/components/01.kit/kit-map'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { getMetroGeometry, getMetroRidePath } from '../../lib/metro-route'

const props = defineProps<{ system: MetroSystemDetails | null, rides: MetroRide[] }>()
const visible = defineModel<boolean>('visible', { required: true })
const scope = ref<'network' | 'rides'>('network')
const showStationNames = ref(true)
const mappedLines = computed(() => (props.system?.lines || []).flatMap((line) => {
  if (scope.value === 'network') {
    const geometry = getMetroGeometry(line.isCircular ? [...line.stations, line.stations[0]!] : line.stations)
    return geometry ? [{ id: line.id, title: line.name, lineNumber: line.lineNumber, color: line.color, geometry, stations: line.stations }] : []
  }
  return props.rides.filter(ride => ride.lineId === line.id).flatMap((ride) => {
    const path = getMetroRidePath(line, ride.startStationId, ride.endStationId)
    const geometry = path && getMetroGeometry(path.stations)
    return path && geometry ? [{ id: ride.id, title: line.name, lineNumber: line.lineNumber, color: line.color, geometry, stations: path.stations }] : []
  })
}))
const mapCenter = computed<[number, number]>(() => {
  const station = mappedLines.value[0]?.stations[0]
  return station ? [station.longitude!, station.latitude!] : [0, 0]
})
const markers = computed(() => [...new Map(mappedLines.value.flatMap(line => line.stations.map(station => [station.id, {
  id: station.id,
  title: station.name,
  coords: { lat: station.latitude!, lon: station.longitude! },
  color: line.color,
  pointType: 'poi' as const,
  shape: 'circle' as const,
  showLabel: showStationNames.value,
  scale: 1,
}] as const))).values()])
const legend = computed(() => [...new Map(mappedLines.value.map((mapped) => {
  const groupKey = `${mapped.lineNumber || mapped.title}|${mapped.color}`
  const base = props.system?.lines.find(line => line.lineNumber === mapped.lineNumber && line.color === mapped.color && !/branch|·/i.test(line.name))
  return [groupKey, { key: groupKey, number: mapped.lineNumber, name: base?.name || mapped.title.split(' · ')[0], color: mapped.color }]
})).values()])
const incomplete = computed(() => scope.value === 'rides' && mappedLines.value.length !== props.rides.length)
watch(visible, (open) => {
  if (open)
    scope.value = props.rides.some(ride => getMetroRidePath(props.system?.lines.find(line => line.id === ride.lineId), ride.startStationId, ride.endStationId)) ? 'rides' : 'network'
})
</script>

<template>
  <KitDialogWithClose v-model:visible="visible" :title="`Метро · ${system?.city || ''}`" :max-width="1040" content-class="metro-map-dialog">
    <div class="metro-map">
      <div class="toolbar">
        <KitViewSwitcher v-model="scope" :items="[{ id: 'network', label: 'Вся сеть', icon: 'mdi:transit-connection-variant' }, { id: 'rides', label: 'Мой маршрут', icon: 'mdi:map-marker-path' }]" />
        <KitBtn
          class="labels-toggle"
          variant="text"
          color="secondary"
          size="sm"
          role="switch"
          :aria-checked="showStationNames"
          @click="showStationNames = !showStationNames"
        >
          <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
          Названия станций
        </KitBtn>
      </div>
      <p v-if="incomplete" class="map-notice" role="status">
        <Icon icon="mdi:information-outline" /> Выберите линию и станции для всех отрезков маршрута.
      </p>
      <div class="map-canvas">
        <KitMap v-if="markers.length" :key="scope" :center="mapCenter" :markers="markers" :routes="mappedLines" height="min(56dvh, 580px)" />
        <div v-else class="empty-state">
          <Icon icon="mdi:map-marker-path" />
          <span>Выберите станции, чтобы увидеть маршрут</span>
        </div>
      </div>
      <ul v-if="legend.length" class="legend" aria-label="Линии метро">
        <li v-for="line in legend" :key="line.key" class="line-item" :title="line.name">
          <Icon icon="mdi:circle" :color="line.color" class="line-swatch" />
          <span v-if="line.number" class="line-code">{{ line.number }}</span>
          <span class="line-name">{{ line.name }}</span>
        </li>
      </ul>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.metro-map {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;

  :deep(.kit-view-switcher .kit-view-switcher-button .kit-view-switcher-label) {
    display: inline;
  }

  :deep(.kit-view-switcher) {
    flex: 0 1 auto;
    width: fit-content;
  }
}
.labels-toggle {
  font-size: 0.8rem;

  :deep(.kit-btn-content) {
    gap: 8px;
  }

  &[aria-checked='true'] {
    .toggle-track {
      background-color: var(--fg-accent-color);
    }
    .toggle-thumb {
      transform: translateX(12px);
    }
  }
}
.toggle-track {
  display: inline-flex;
  align-items: center;
  width: 32px;
  height: 20px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 999px;
  background-color: var(--fg-tertiary-color);
  transition: background-color 0.2s;
}
.toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #fff;
  transition: transform 0.2s;
}
.map-canvas {
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  min-height: 180px;
}
.legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 20px;
  list-style: none;
  margin: 0;
  padding: 2px 0;
}
.line-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 0.8rem;
  line-height: 1.5;
}
.line-swatch {
  flex-shrink: 0;
  font-size: 12px;
}
.line-code {
  font-weight: 650;
  flex-shrink: 0;
  min-width: 18px;
}
.line-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg-secondary-color);
}
.map-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}
.empty-state {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--fg-secondary-color);

  > svg {
    font-size: 32px;
  }
}
@include media-down(sm) {
  .legend {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
  }
  .toolbar {
    justify-content: center;
  }
}
</style>
