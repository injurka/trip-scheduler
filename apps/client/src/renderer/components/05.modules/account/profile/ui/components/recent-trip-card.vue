<script setup lang="ts">
import type { ITrip } from '~/components/05.modules/trips-hub/models/types'
import { Icon } from '@iconify/vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { AppRoutePaths } from '~/shared/constants/routes'

const props = defineProps<{ trip: ITrip }>()
const router = useRouter()

function goToTrip() {
  router.push(AppRoutePaths.Trip.Info(props.trip.id))
}

const formattedDates = computed(() => {
  const start = new Date(props.trip.startDate)
  const end = new Date(props.trip.endDate)
  const formatter = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })
  if (start.getFullYear() === end.getFullYear()) {
    return `${formatter.format(start)} - ${formatter.format(end)}`
  }
  else {
    return `${formatter.format(start)} ${start.getFullYear()} - ${formatter.format(end)} ${end.getFullYear()}`
  }
})

const statusInfo = computed(() => {
  switch (props.trip.status) {
    case 'completed': return { text: 'Завершено', class: 'completed', icon: 'mdi:check-circle-outline' }
    case 'planned': return { text: 'Запланировано', class: 'planned', icon: 'mdi:calendar-check-outline' }
    default: return { text: 'Черновик', class: 'draft', icon: 'mdi:pencil-circle-outline' }
  }
})
</script>

<template>
  <div class="recent-trip-card" @click="goToTrip">
    <div class="card-cover">
      <KitImage v-if="trip.imageUrl" :src="trip.imageUrl" :alt="trip.title" />
      <div v-else class="cover-placeholder">
        <Icon icon="mdi:map-legend" />
      </div>
    </div>
    <div class="card-info">
      <h4 class="trip-title">
        {{ trip.title }}
      </h4>
      <div class="trip-meta">
        <div class="meta-item">
          <Icon icon="mdi:calendar-month-outline" />
          <span>{{ formattedDates }}</span>
        </div>
        <div v-if="trip.cities.length" class="meta-item">
          <Icon icon="mdi:map-marker-outline" />
          <span>{{ trip.cities.join(', ') }}</span>
        </div>
      </div>
    </div>
    <div class="card-status" :class="statusInfo.class">
      <Icon :icon="statusInfo.icon" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.recent-trip-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  padding: 0.75rem;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--s-m);
    border-color: var(--border-primary-color);
  }
}

.card-cover {
  width: 100px;
  height: 100px;
  border-radius: var(--r-s);
  overflow: hidden;
  flex-shrink: 0;

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-secondary-color);
    color: var(--fg-tertiary-color);
    font-size: 1.5rem;
  }
}

.card-info {
  flex-grow: 1;
  min-width: 0;

  .trip-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    white-space: normal;
    word-break: break-word;
    padding-right: 24px;
  }
}

.trip-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

.card-status {
  position: absolute;
  top: -1px;
  right: -1px;
  padding: 0.5rem 0.75rem;
  border-bottom-left-radius: var(--r-m);
  font-size: 1rem;

  &.completed {
    background-color: var(--bg-success-color);
    color: var(--fg-success-color);
  }
  &.planned {
    background-color: var(--bg-warning-color);
    color: var(--fg-warning-color);
  }
  &.draft {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-tertiary-color);
  }
}
</style>
