<script setup lang="ts">
import type { MetroSystemDetails } from '../../lib/metro-route'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { ActivitySectionMetro, MetroRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { v4 as uuidv4 } from 'uuid'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { metroService } from '~/shared/services/database/metro.service'
import { getMetroGeometry, getMetroRidePath } from '../../lib/metro-route'
import MetroMapDialog from './metro-map-dialog.vue'

interface Props {
  section: ActivitySectionMetro
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'updateSection', value: ActivitySectionMetro): void
}>()

const sectionData = computed(() => {
  const rides = (props.section.rides || []).map(ride => ({
    ...ride,
    startStationId: ride.startStationId !== undefined ? ride.startStationId : null,
    endStationId: ride.endStationId !== undefined ? ride.endStationId : null,
    lineId: ride.lineId !== undefined ? ride.lineId : null,
  }))
  return {
    ...props.section,
    mode: props.section.mode || 'free',
    systemId: props.section.systemId !== undefined ? props.section.systemId : null,
    rides,
  }
})

const metroSystems = ref<{ id: string, city: string }[]>([])
const activeSystemDetails = ref<MetroSystemDetails | null>(null)
const loadError = ref('')
const showMap = ref(false)
const hasMapData = computed(() => activeSystemDetails.value?.lines.some(line => getMetroGeometry(line.stations)))
function ridePath(ride: MetroRide) {
  return getMetroRidePath(activeSystemDetails.value?.lines.find(line => line.id === ride.lineId), ride.startStationId, ride.endStationId)
}
function intermediateStations(ride: MetroRide) {
  return ridePath(ride)?.stations.slice(1, -1) || []
}
function getStops(ride: MetroRide) {
  return sectionData.value.mode === 'city' ? (ridePath(ride)?.stops ?? ride.stops) : ride.stops
}

const isLoadingSystems = ref(false)
const isLoadingDetails = ref(false)

const systemOptions = computed((): KitDropdownItem<string>[] =>
  metroSystems.value.map(s => ({ value: s.id, label: s.city })),
)

const lineOptions = computed((): KitDropdownItem<string>[] =>
  activeSystemDetails.value?.lines.map(l => ({ value: l.id, label: `${l.lineNumber ? `${l.lineNumber} ` : ''}${l.name}` })) || [],
)

function getStationOptionsForLine(lineId: string | null): KitDropdownItem<string>[] {
  if (!lineId || !activeSystemDetails.value)
    return []
  const line = activeSystemDetails.value.lines.find(l => l.id === lineId)
  return line?.stations.map(s => ({ value: s.id, label: s.name })) || []
}

function getDirectionText(ride: MetroRide): string {
  if (sectionData.value.mode !== 'city')
    return ride.direction || '...'
  const path = ridePath(ride)
  if (path)
    return path.direction
  if (!activeSystemDetails.value)
    return ride.direction || (isLoadingDetails.value ? 'Загрузка маршрута…' : 'Направление не указано')
  if (props.readonly)
    return ride.direction || 'Маршрут недоступен'
  if (!ride.lineId || !ride.startStationId || !ride.endStationId)
    return 'Выберите линию и станции'
  return ride.startStationId === ride.endStationId
    ? 'Выберите разные станции'
    : 'Станции не найдены на выбранной линии'
}

async function fetchMetroSystems() {
  isLoadingSystems.value = true
  try {
    metroSystems.value = await metroService.listSystems()
  }
  catch (e) {
    console.error('Failed to fetch metro systems:', e)
    loadError.value = 'Не удалось загрузить список городов'
  }
  finally {
    isLoadingSystems.value = false
  }
}

let detailsRequest = 0
async function fetchSystemDetails(systemId: string | null) {
  const request = ++detailsRequest
  activeSystemDetails.value = null
  isLoadingDetails.value = false
  loadError.value = ''
  if (!systemId || sectionData.value.mode !== 'city')
    return
  isLoadingDetails.value = true
  try {
    const details = await metroService.getDetails(systemId)
    if (request === detailsRequest)
      activeSystemDetails.value = details
  }
  catch (e) {
    if (request === detailsRequest)
      loadError.value = 'Не удалось загрузить метро. Попробуйте ещё раз.'
    console.error('Failed to fetch metro details:', e)
  }
  finally {
    if (request === detailsRequest)
      isLoadingDetails.value = false
  }
}

function handleSystemChange(systemId: string | null) {
  if (systemId === sectionData.value.systemId)
    return
  showMap.value = false
  updateSection({ systemId, rides: sectionData.value.rides.map(ride => ({
    ...ride,
    lineId: null,
    lineNumber: null,
    lineName: '',
    lineColor: '#808080',
    startStationId: null,
    startStation: '',
    endStationId: null,
    endStation: '',
    direction: '',
    stops: 0,
  })) })
}

function updateSection(newSectionData: Partial<ActivitySectionMetro>) {
  emit('updateSection', { ...sectionData.value, ...newSectionData })
}

function handleModeChange(newMode: 'free' | 'city') {
  const newSection: ActivitySectionMetro = { ...sectionData.value, mode: newMode }
  if (newMode === 'free') {
    newSection.systemId = null
    activeSystemDetails.value = null
  }
  emit('updateSection', newSection)
}

function updateRide(rideId: string, updatedRide: Partial<MetroRide>) {
  const updatedRides = sectionData.value.rides.map((ride) => {
    if (ride.id !== rideId)
      return ride
    const next = { ...ride, ...updatedRide }
    if (sectionData.value.mode === 'city') {
      const path = ridePath(next)
      next.stops = path?.stops ?? 0
      next.direction = path?.direction ?? ''
    }
    return next
  })
  updateSection({ rides: updatedRides })
}

function handleLineChange(ride: MetroRide, newLineId: string | null) {
  const line = activeSystemDetails.value?.lines.find(l => l.id === newLineId)

  updateRide(ride.id, {
    lineId: newLineId,
    lineNumber: line?.lineNumber || null,
    lineName: line?.name || '',
    lineColor: line?.color || '#808080',
    startStationId: null,
    startStation: '',
    endStationId: null,
    endStation: '',
  })
}

function handleStationChange(ride: MetroRide, field: 'startStation' | 'endStation', stationId: string | null) {
  const station = activeSystemDetails.value?.lines.find(line => line.id === ride.lineId)?.stations.find(s => s.id === stationId)

  updateRide(ride.id, {
    [`${field}Id`]: stationId,
    [field]: station?.name || '',
  })
}

function addRide() {
  const newRide: MetroRide = {
    id: uuidv4(),
    startStation: '',
    endStation: '',
    lineName: '',
    lineNumber: null,
    lineColor: '#808080',
    direction: '',
    stops: 1,
    startStationId: null,
    endStationId: null,
    lineId: null,
  }
  updateSection({ rides: [...sectionData.value.rides, newRide] })
}

function removeRide(rideId: string) {
  const updatedRides = sectionData.value.rides.filter(ride => ride.id !== rideId)
  updateSection({ rides: updatedRides })
}

onMounted(fetchMetroSystems)
watch(() => [sectionData.value.systemId, sectionData.value.mode] as const, ([id]) => {
  fetchSystemDetails(id)
}, { immediate: true })
</script>

<template>
  <div class="metro-section" :class="{ 'with-map': sectionData.mode === 'city' }">
    <div v-if="!readonly" class="controls-header">
      <KitViewSwitcher
        :model-value="sectionData.mode"
        :items="[{ id: 'free', label: 'Свободный ввод' }, { id: 'city', label: 'По городу' }]"
        @update:model-value="handleModeChange($event as 'free' | 'city')"
      />
      <KitSelectWithSearch
        v-if="sectionData.mode === 'city'"
        :model-value="sectionData.systemId"
        :items="systemOptions"
        :loading="isLoadingSystems"
        placeholder="Выберите город"
        class="city-selector"
        @update:model-value="handleSystemChange($event as string | null)"
      />
    </div>

    <p v-if="loadError" role="alert">
      {{ loadError }} <KitBtn size="sm" variant="text" @click="fetchMetroSystems(); fetchSystemDetails(sectionData.systemId)">
        Повторить
      </KitBtn>
    </p>
    <p v-if="sectionData.mode === 'city' && activeSystemDetails && !activeSystemDetails.lines.length">
      В этом городе пока нет линий метро.
    </p>
    <KitBtn
      v-if="sectionData.mode === 'city'"
      class="map-button"
      color="secondary"
      :disabled="!hasMapData"
      variant="text"
      icon="mdi:map-search-outline"
      size="sm"
      aria-label="На карте"
      @click="showMap = true"
    />
    <MetroMapDialog v-model:visible="showMap" :system="activeSystemDetails" :rides="sectionData.rides" />

    <div class="rides-container">
      <div v-for="(ride, index) in sectionData.rides" :key="ride.id" class="ride-wrapper">
        <div class="ride-segment" :class="{ editable: !readonly }">
          <!-- Editable City Mode -->
          <div v-if="sectionData.mode === 'city' && !readonly" class="ride-content city-mode editable">
            <div class="line-indicator" :style="{ backgroundColor: ride.lineColor }">
              <span class="line-number">{{ ride.lineNumber }}</span>
            </div>
            <div class="city-inputs">
              <KitSelectWithSearch :model-value="ride.lineId" :items="lineOptions" :loading="isLoadingDetails" placeholder="Линия" @update:model-value="handleLineChange(ride, $event as string)" />
              <KitSelectWithSearch :model-value="ride.startStationId" :items="getStationOptionsForLine(ride.lineId)" placeholder="Откуда" @update:model-value="handleStationChange(ride, 'startStation', $event as string)" />
              <KitSelectWithSearch :model-value="ride.endStationId" :items="getStationOptionsForLine(ride.lineId)" placeholder="Куда" @update:model-value="handleStationChange(ride, 'endStation', $event as string)" />
              <span v-if="ridePath(ride)" class="city-ride-summary">{{ getDirectionText(ride) }} · {{ getStops(ride) }} ост.</span>
            </div>
          </div>

          <!-- Editable Free Mode -->
          <div v-else-if="sectionData.mode === 'free' && !readonly" class="ride-content free-mode editable">
            <div class="line-indicator" :style="{ backgroundColor: ride.lineColor }">
              <span class="line-number">{{ ride.lineNumber }}</span>
            </div>
            <div class="free-mode-grid">
              <KitInput :model-value="ride.startStation" placeholder="Откуда" size="sm" @update:model-value="updateRide(ride.id, { startStation: $event as string })" />
              <KitInput :model-value="ride.endStation" placeholder="Куда" size="sm" @update:model-value="updateRide(ride.id, { endStation: $event as string })" />
              <KitInput :model-value="ride.lineName" placeholder="Название линии" size="sm" @update:model-value="updateRide(ride.id, { lineName: $event as string })" />
              <KitInput :model-value="ride.lineNumber" placeholder="№" size="sm" @update:model-value="updateRide(ride.id, { lineNumber: $event as string })" />
              <div class="line-color-picker">
                <input type="color" :value="ride.lineColor" class="color-input" @input="updateRide(ride.id, { lineColor: ($event.target as HTMLInputElement).value })">
              </div>
              <KitInput :model-value="ride.direction" placeholder="Направление (необяз.)" size="sm" @update:model-value="updateRide(ride.id, { direction: $event as string })" />
              <KitInput :model-value="ride.stops" placeholder="Остановки" type="number" size="sm" @update:model-value="updateRide(ride.id, { stops: Number($event) || 0 })" />
            </div>
          </div>

          <!-- Readonly View (for both modes) -->
          <div v-else class="ride-content readonly">
            <div class="line-indicator" :style="{ backgroundColor: ride.lineColor }">
              <span v-if="ride.lineNumber" class="line-number">{{ ride.lineNumber }}</span>
            </div>
            <div class="ride-info">
              <div class="station start">
                <span class="station-name">{{ ride.startStation || '...' }}</span>
              </div>
              <div class="ride-path">
                <div class="path-line" />
                <div class="path-details">
                  <span>{{ getDirectionText(ride) }}</span>
                  <div class="stops-row">
                    <span v-if="sectionData.mode === 'free' && getStops(ride) > 0" class="stops-count">{{ getStops(ride) }} ост.</span>
                    <details
                      v-if="sectionData.mode === 'city' && intermediateStations(ride).length"
                      class="station-list"
                    >
                      <summary>
                        Промежуточные станции · {{ getStops(ride) - 1 }}
                        <Icon icon="mdi:chevron-down" class="expand-icon" />
                      </summary>
                      <ol aria-label="Промежуточные станции">
                        <li v-for="station in intermediateStations(ride)" :key="station.id">
                          {{ station.name }}
                        </li>
                      </ol>
                    </details>
                  </div>
                </div>
              </div>
              <div class="station end">
                <span class="station-name">{{ ride.endStation || '...' }}</span>
              </div>
            </div>
          </div>

          <KitBtn v-if="!readonly" icon="mdi:delete-outline" variant="text" size="sm" class="delete-ride-btn" @click="removeRide(ride.id)" />
        </div>
        <div v-if="index < sectionData.rides.length - 1" class="transfer-info">
          <Icon icon="mdi:swap-horizontal-bold" class="transfer-icon" />
          <span>Пересадка</span>
        </div>
      </div>
    </div>

    <div v-if="!readonly" class="add-ride-wrapper">
      <KitBtn variant="subtle" icon="mdi:plus" @click="addRide">
        Добавить отрезок
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.map-button {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fg-tertiary-color);
}
.stops-row {
  min-height: 1.5em;
  line-height: 1.5;
}
.station-list {
  margin: 0;

  summary {
    display: flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    cursor: pointer;
    color: var(--fg-primary-color);
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    &:focus-visible {
      outline: 2px solid var(--fg-accent-color);
      outline-offset: 4px;
      border-radius: var(--r-s);
    }
  }

  .expand-icon {
    transition: transform 0.2s;
  }

  &[open] .expand-icon {
    transform: rotate(180deg);
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 12px 0;
    padding: 0 0 0 18px;
    list-style: circle;
    line-height: 1.5;
  }
}
.city-ride-summary {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}
.metro-section {
  position: relative;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.metro-section.with-map {
  padding-right: 60px;
}
.controls-header {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.city-selector {
  min-width: 200px;
}
.rides-container {
  display: flex;
  flex-direction: column;
}
.ride-wrapper {
  display: flex;
  flex-direction: column;
}
.ride-segment {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  padding: 8px 0;
  min-height: 54px;
}
.line-indicator {
  width: 24px;
  opacity: 0.5;
  height: 100%;
  position: absolute;
  left: -8px;
  top: 0;
  bottom: 0;
  border-radius: var(--r-s) 0 0 var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;

  .line-number {
    color: white;
    border-radius: 100%;
    background-color: #20202050;
    width: 20px;
    height: 20px;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 700;
    font-family: var(--font-accent);
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
.ride-segment.editable .line-indicator {
  height: 54px;
  top: 50%;
  left: -8px;
  transform: translateY(-50%);
  border-radius: var(--r-s);

  .line-number {
    display: none;
  }
}
.ride-content {
  flex-grow: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}
.city-mode.editable .city-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  width: 100%;
}
@include media-down(sm) {
  .city-mode.editable .city-inputs {
    grid-template-columns: minmax(0, 1fr);
  }
}
.free-mode.editable .free-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 8px;
  width: 100%;
  align-items: center;
  :deep(.kit-input-group) {
    gap: 4px;
  }
}
.line-color-picker {
  position: relative;
  width: 100%;
  height: 36px;
  flex-shrink: 0;
  align-self: center;
  justify-self: center;
  border-radius: var(--r-s);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  .color-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    padding: 0;
    border: none;
  }
}
.ride-content.readonly {
  padding-left: 32px;
}
.ride-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.station {
  display: flex;
  align-items: center;
  gap: 8px;
  &::before {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--border-primary-color);
    background-color: var(--bg-secondary-color);
  }
  &.end::before {
    background-color: var(--border-primary-color);
  }
}
.station-name {
  font-weight: 500;
}
.line-info {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}
.ride-path {
  display: flex;
  align-items: center;
  padding-left: 3px;
  gap: 8px;
}
.path-line {
  width: 2px;
  height: 100%;
  background-color: var(--border-secondary-color);
}
.path-details {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  display: flex;
  flex-direction: column;

  .stops-count {
    font-style: italic;
  }
}
.transfer-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 8px 16px;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  .transfer-icon {
    font-size: 1.2rem;
  }
}
.delete-ride-btn {
  color: var(--fg-tertiary-color) !important;
  &:hover {
    color: var(--fg-error-color) !important;
  }
}
.add-ride-wrapper {
  margin-top: 8px;
}
</style>
