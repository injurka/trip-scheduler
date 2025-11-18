<script setup lang="ts">
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { EActivityTag } from '~/shared/types/models/activity'

interface Props {
  visible: boolean
  days: IDay[]
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'navigate', dayId: string): void
}>()

const router = useRouter()
const route = useRoute()

const attractionsByDay = computed(() => {
  return props.days
    .map(day => ({
      ...day,
      attractions: day.activities.filter(act => act.tag === EActivityTag.ATTRACTION),
    }))
    .filter(day => day.attractions.length > 0)
})

function handleNavigate(dayId: string) {
  emit('navigate', dayId)
  emit('update:visible', false)
}

function showOnMap() {
  emit('update:visible', false)
  router.push({ query: { ...route.query, view: 'map' } })
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Достопримечательности"
    icon="mdi:camera"
    :max-width="800"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="dialog-content">
      <div class="show-on-map-wrapper">
        <KitBtn icon="mdi:map-outline" variant="text" @click="showOnMap">
          Показать всё на карте
        </KitBtn>
      </div>

      <div v-if="attractionsByDay.length > 0" class="days-list">
        <div v-for="(day, index) in attractionsByDay" :key="day.id" class="day-group">
          <button class="day-header" @click="handleNavigate(day.id)">
            <div class="day-info">
              <span class="day-number">{{ index + 1 }}</span>
              <div class="day-title-wrapper">
                <h3 class="day-title">
                  {{ day.title || `День ${index + 1}` }}
                </h3>
                <span class="day-date">{{ new Date(day.date).toLocaleDateString('ru-RU', { month: 'long', day: 'numeric' }) }}</span>
              </div>
            </div>
            <Icon icon="mdi:chevron-right" class="chevron-icon" />
          </button>
          <ul class="attractions-list">
            <li v-for="attraction in day.attractions" :key="attraction.id" class="attraction-item">
              <span class="time">{{ attraction.startTime }}</span>
              <span class="title">{{ attraction.title }}</span>
            </li>
          </ul>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>В вашем маршруте не запланировано посещение достопримечательностей.</p>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.show-on-map-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}
.dialog-content {
  padding-top: 1rem;
}
.days-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.day-group {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
}
.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 100%;
  border: none;
  background-color: var(--bg-tertiary-color);
  color: inherit;
  font-family: inherit;

  &:hover {
    background-color: var(--bg-hover-color);
    .chevron-icon {
      transform: translateX(4px);
      color: var(--fg-accent-color);
    }
  }
}

.day-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
}

.day-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-title-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--fg-primary-color);
}

.day-date {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
}

.chevron-icon {
  font-size: 1.5rem;
  color: var(--fg-tertiary-color);
  transition:
    transform 0.2s ease,
    color 0.2s ease;
}

.attractions-list {
  list-style: none;
  padding: 0.75rem 1rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.attraction-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;

  .time {
    font-family: var(--font-mono);
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
    width: 44px;
    flex-shrink: 0;
  }
  .title {
    color: var(--fg-primary-color);
  }
}
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--fg-secondary-color);
}
</style>
