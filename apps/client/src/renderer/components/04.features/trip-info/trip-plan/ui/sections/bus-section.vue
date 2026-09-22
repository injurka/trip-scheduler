<script setup lang="ts">
import type { ActivitySectionBus, BusRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { v4 as uuidv4 } from 'uuid'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props {
  section: ActivitySectionBus
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'updateSection', value: ActivitySectionBus): void
}>()

const sectionData = computed(() => {
  const rides = (props.section.rides || []).map(ride => ({
    ...ride,
    color: ride.color || '#F59E0B',
    stops: Number(ride.stops) || 0,
    code: ride.code !== undefined ? ride.code : null,
    operator: ride.operator !== undefined ? ride.operator : null,
    direction: ride.direction || '',
    walk: ride.walk !== undefined ? ride.walk : null,
    links: ride.links || [],
  }))
  return {
    ...props.section,
    rides,
  }
})

function updateSection(newSectionData: Partial<ActivitySectionBus>) {
  emit('updateSection', { ...sectionData.value, ...newSectionData })
}

function updateRide(rideId: string, updatedRide: Partial<BusRide>) {
  const updatedRides = sectionData.value.rides.map(ride =>
    ride.id === rideId ? { ...ride, ...updatedRide } : ride,
  )
  updateSection({ rides: updatedRides })
}

function addRide() {
  const newRide: BusRide = {
    id: uuidv4(),
    from: '',
    to: '',
    route: '',
    code: null,
    color: '#F59E0B',
    operator: null,
    direction: '',
    stops: 1,
    walk: null,
    links: [],
  }
  updateSection({ rides: [...sectionData.value.rides, newRide] })
}

function removeRide(rideId: string) {
  const updatedRides = sectionData.value.rides.filter(ride => ride.id !== rideId)
  updateSection({ rides: updatedRides })
}
</script>

<template>
  <div class="bus-section">
    <div class="rides-container">
      <div v-for="(ride, index) in sectionData.rides" :key="ride.id" class="ride-wrapper">
        <div class="ride-segment" :class="{ editable: !readonly }">
          <!-- Editable Mode -->
          <div v-if="!readonly" class="ride-content free-mode editable">
            <div class="line-indicator" :style="{ backgroundColor: ride.color }">
              <span v-if="ride.code && ride.code.length <= 3" class="line-number">{{ ride.code }}</span>
              <Icon v-else icon="mdi:bus" class="bus-icon-indicator" />
            </div>
            <div class="free-mode-grid">
              <KitInput
                :model-value="ride.from"
                placeholder="Остановка отправления (Откуда)"
                size="sm"
                @update:model-value="updateRide(ride.id, { from: $event as string })"
              />
              <KitInput
                :model-value="ride.to"
                placeholder="Остановка прибытия (Куда)"
                size="sm"
                @update:model-value="updateRide(ride.id, { to: $event as string })"
              />
              <KitInput
                :model-value="ride.route"
                placeholder="Название маршрута"
                size="sm"
                @update:model-value="updateRide(ride.id, { route: $event as string })"
              />
              <KitInput
                :model-value="ride.code"
                placeholder="№ / Код маршрута"
                size="sm"
                @update:model-value="updateRide(ride.id, { code: $event as string })"
              />
              <KitInput
                :model-value="ride.operator"
                placeholder="Оператор (необяз.)"
                size="sm"
                @update:model-value="updateRide(ride.id, { operator: $event as string })"
              />
              <KitInput
                :model-value="ride.direction"
                placeholder="Направление"
                size="sm"
                @update:model-value="updateRide(ride.id, { direction: $event as string })"
              />
              <KitInput
                :model-value="ride.stops"
                placeholder="Количество остановок"
                type="number"
                size="sm"
                @update:model-value="updateRide(ride.id, { stops: Number($event) || 0 })"
              />
              <KitInput
                :model-value="ride.walk"
                placeholder="Пеший переход (напр. 260 м / 4 мин)"
                size="sm"
                @update:model-value="updateRide(ride.id, { walk: $event as string })"
              />
              <div class="line-color-picker">
                <input
                  type="color"
                  :value="ride.color"
                  class="color-input"
                  title="Цвет маршрута"
                  @input="updateRide(ride.id, { color: ($event.target as HTMLInputElement).value })"
                >
              </div>
            </div>
            <KitBtn
              icon="mdi:delete-outline"
              variant="text"
              size="sm"
              class="delete-ride-btn"
              @click="removeRide(ride.id)"
            />
          </div>

          <!-- Readonly View -->
          <div v-else class="ride-content readonly">
            <div class="line-indicator" :style="{ backgroundColor: ride.color }">
              <span v-if="ride.code && ride.code.length <= 3" class="line-number">{{ ride.code }}</span>
              <Icon v-else icon="mdi:bus" class="bus-icon-indicator" />
            </div>
            <div class="ride-info">
              <div class="station start">
                <span class="station-name">{{ ride.from || '...' }}</span>
              </div>
              <div class="ride-path">
                <div class="path-line" />
                <div class="path-details">
                  <div class="route-header">
                    <span class="route-title">{{ ride.route || 'Автобус' }}</span>
                    <span v-if="ride.code" class="route-code-badge" :style="{ backgroundColor: ride.color }">
                      {{ ride.code }}
                    </span>
                    <span v-if="ride.operator" class="route-operator">
                      • {{ ride.operator }}
                    </span>
                  </div>
                  <div v-if="ride.direction" class="route-direction">
                    в сторону «{{ ride.direction }}»
                  </div>
                  <div class="route-meta">
                    <span v-if="ride.stops > 0" class="stops-count">
                      {{ ride.stops }} {{ ride.stops === 1 ? 'ост.' : (ride.stops > 1 && ride.stops < 5 ? 'ост-ки' : 'ост-ок') }}
                    </span>
                    <span v-if="ride.walk" class="walk-info">
                      <Icon icon="mdi:walk" class="walk-icon" />
                      {{ ride.walk }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="station end">
                <span class="station-name">{{ ride.to || '...' }}</span>
              </div>
            </div>
          </div>
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
.bus-section {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  opacity: 0.85;
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
    background-color: #20202070;
    width: 22px;
    height: 22px;
    text-align: center;
    font-size: 0.72rem;
    font-weight: 700;
    font-family: var(--font-accent);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .bus-icon-indicator {
    color: white;
    font-size: 1rem;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
}

.ride-segment.editable .line-indicator {
  height: 54px;
  top: 50%;
  left: -8px;
  transform: translateY(-50%);
  border-radius: var(--r-s);
}

.ride-content {
  flex-grow: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.free-mode.editable .free-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  font-size: 0.95rem;
}

.ride-path {
  display: flex;
  align-items: stretch;
  padding-left: 3px;
  gap: 10px;
  min-height: 40px;
}

.path-line {
  width: 2px;
  background-color: var(--border-secondary-color);
  border-radius: 1px;
}

.path-details {
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px 0;
}

.route-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.route-title {
  font-weight: 600;
  color: var(--fg-primary-color);
}

.route-code-badge {
  color: #fff;
  font-weight: 700;
  font-size: 0.72rem;
  padding: 1px 6px;
  border-radius: 999px;
  line-height: 1.2;
}

.route-operator {
  font-size: 0.78rem;
  color: var(--fg-tertiary-color);
}

.route-direction {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.route-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: var(--fg-tertiary-color);
  margin-top: 2px;
}

.stops-count {
  font-style: italic;
}

.walk-info {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--fg-secondary-color);

  .walk-icon {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
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
