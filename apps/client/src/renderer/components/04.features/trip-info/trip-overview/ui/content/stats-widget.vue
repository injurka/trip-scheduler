<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitDivider } from '~/components/01.kit/kit-divider'

interface Props {
  durationDays: number
  cityCount: number
  participantCount: number
  attractionCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'showDays'): void
  (e: 'showCities'): void
  (e: 'showParticipants'): void
  (e: 'showAttractions'): void
}>()

function getRussianPlural(count: number, titles: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2]
  const index = (count % 100 > 4 && count % 100 < 20) ? 2 : cases[(count % 10 < 5) ? count % 10 : 5]
  return titles[index]
}

const dayLabel = computed(() => getRussianPlural(props.durationDays, ['День', 'Дня', 'Дней']))
const cityLabel = computed(() => getRussianPlural(props.cityCount, ['Город', 'Города', 'Городов']))
const participantLabel = computed(() => getRussianPlural(props.participantCount, ['Участник', 'Участника', 'Участников']))
const attractionLabel = computed(() => getRussianPlural(props.attractionCount, ['достопримечательность', 'достопримечательности', 'достопримечательностей']))
</script>

<template>
  <div class="info-widget-card stats-widget">
    <div class="main-stats">
      <button class="stat-item" @click="emit('showDays')">
        <div class="icon-wrapper">
          <Icon icon="mdi:calendar-range" class="stat-icon" />
        </div>
        <div class="stat-text">
          <span class="stat-value">{{ durationDays }}</span>
          <span class="stat-label">{{ dayLabel }}</span>
        </div>
      </button>
      <button class="stat-item" @click="emit('showCities')">
        <div class="icon-wrapper">
          <Icon icon="mdi:city-variant-outline" class="stat-icon" />
        </div>
        <div class="stat-text">
          <span class="stat-value">{{ cityCount }}</span>
          <span class="stat-label">{{ cityLabel }}</span>
        </div>
      </button>
      <button class="stat-item" @click="emit('showParticipants')">
        <div class="icon-wrapper">
          <Icon icon="mdi:account-group-outline" class="stat-icon" />
        </div>
        <div class="stat-text">
          <span class="stat-value">{{ participantCount }}</span>
          <span class="stat-label">{{ participantLabel }}</span>
        </div>
      </button>
    </div>

    <div v-if="attractionCount > 0" class="secondary-stats">
      <KitDivider />
      <button class="stat-item-horizontal" @click="emit('showAttractions')">
        <div class="icon-wrapper">
          <Icon icon="mdi:camera" class="stat-icon" />
        </div>
        <div class="stat-text-horizontal">
          <span class="stat-value-horizontal">{{ attractionCount }}</span>
          <span class="stat-label-horizontal">{{ attractionLabel }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stats-widget {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.main-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 1rem;
  height: 100%;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 24px;
  padding: 1rem 0.5rem;
  border-radius: var(--r-m);
  background-color: var(--bg-tertiary-color);
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  border: none;
  font-family: inherit;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-m);
    background-color: var(--bg-hover-color);
  }
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.stat-item:hover .icon-wrapper,
.stat-item-horizontal:hover .icon-wrapper {
  background-color: var(--bg-accent-color-translucent);
  border-color: var(--fg-accent-color);
}

.stat-icon {
  font-size: 1.75rem;
  color: var(--fg-accent-color);
  transition: color 0.2s ease;
}

.stat-text {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  line-height: 1.1;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.secondary-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stat-item-horizontal {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: var(--r-m);
  background-color: var(--bg-tertiary-color);
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  border: none;
  font-family: inherit;
  width: 100%;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-m);
    background-color: var(--bg-hover-color);
  }

  .icon-wrapper {
    width: 40px;
    height: 40px;
    .stat-icon {
      font-size: 1.5rem;
    }
  }

  .stat-text-horizontal {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    text-align: left;
  }

  .stat-value-horizontal {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .stat-label-horizontal {
    font-size: 1rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    text-overflow: ellipsis;
    overflow: hidden;
  }
}

@include media-down(sm) {
  .stats-widget {
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .main-stats {
    gap: 0.5rem;
  }
  .stat-label-horizontal {
    font-size: 0.8rem;
  }
}
</style>
