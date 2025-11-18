<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { ActivitySectionMetro, MetroRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { v4 as uuidv4 } from 'uuid'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { trpc } from '~/shared/services/trpc/trpc.service'

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
const activeSystemDetails = ref<{
  id: string
  city: string
  lines: { id: string, name: string, lineNumber: string | null, color: string, stations: { id: string, name: string }[] }[]
} | null>(null)

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
  if (props.section.mode === 'free' || !activeSystemDetails.value || !ride.lineId || !ride.startStationId || !ride.endStationId) {
    return ride.direction || '...'
  }

  const line = activeSystemDetails.value.lines.find(l => l.id === ride.lineId)
  if (!line || line.stations.length < 2)
    return '...'

  const startIndex = line.stations.findIndex(s => s.id === ride.startStationId)
  const endIndex = line.stations.findIndex(s => s.id === ride.endStationId)

  if (startIndex === -1 || endIndex === -1 || startIndex === endIndex)
    return '...'

  const terminusStation = endIndex > startIndex ? line.stations[line.stations.length - 1] : line.stations[0]
  return `в сторону ст. «${terminusStation.name}»`
}

async function fetchMetroSystems() {
  isLoadingSystems.value = true
  try {
    metroSystems.value = await trpc.metro.listSystems.query() as { id: string, city: string }[]
  }
  catch (e) {
    console.error('Failed to fetch metro systems:', e)
  }
  finally {
    isLoadingSystems.value = false
  }
}

async function fetchSystemDetails(systemId: string) {
  if (!systemId) {
    activeSystemDetails.value = null
    return
  }
  isLoadingDetails.value = true
  try {
    activeSystemDetails.value = await trpc.metro.getDetails.query({ systemId }) as any
  }
  catch (e) {
    console.error(`Failed to fetch metro system details for ${systemId}:`, e)
    activeSystemDetails.value = null
  }
  finally {
    isLoadingDetails.value = false
  }
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
  const updatedRides = sectionData.value.rides.map(ride =>
    ride.id === rideId ? { ...ride, ...updatedRide } : ride,
  )
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
  const station = activeSystemDetails.value?.lines
    .flatMap(l => l.stations)
    .find(s => s.id === stationId)

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

onMounted(() => {
  fetchMetroSystems()
  if (sectionData.value.systemId) {
    fetchSystemDetails(sectionData.value.systemId)
  }
})

watch(() => sectionData.value.systemId, (newId) => {
  if (newId && sectionData.value.mode === 'city') {
    fetchSystemDetails(newId)
  }
  else {
    activeSystemDetails.value = null
  }
})
</script>

<template>
  <div class="metro-section">
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
        @update:model-value="updateSection({ systemId: $event as string })"
      />
    </div>

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
                  <span v-if="ride.stops > 0">{{ ride.stops }} {{ ride.stops === 1 ? 'ост.' : (ride.stops > 1 && ride.stops < 5 ? 'ост-ки' : 'ост-ок') }}</span>
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
.metro-section {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
    font-family: 'Sansation';
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
  height: 32px;
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
