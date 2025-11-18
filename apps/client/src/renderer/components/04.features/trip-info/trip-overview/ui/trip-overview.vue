<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import type { Trip, TripSection } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitAnimatedTooltip } from '~/components/01.kit/kit-animated-tooltip'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'
import { EActivityTag } from '~/shared/types/models/activity'
import { TripStatus } from '~/shared/types/models/trip'
import CountdownWidget from './content/countdown-widget.vue'
import StatsWidget from './content/stats-widget.vue'
import WeatherWidget from './content/weather-widget.vue'
import {
  AttractionsListDialog,
  CitiesListDialog,
  DaysListDialog,
  ParticipantsListDialog,
} from './dialogs'

interface Props {
  trip: Trip | null
  sections: TripSection[]
  days: IDay[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
}>()

const router = useRouter()
const confirm = useConfirm()
const { canEdit } = useTripPermissions()

const isMoreMenuOpen = ref(false)

const isDaysDialogVisible = ref(false)
const isCitiesDialogVisible = ref(false)
const isParticipantsDialogVisible = ref(false)
const isAttractionsDialogVisible = ref(false)

const isTripUpcoming = computed(() => {
  if (!props.trip)
    return false

  return props.trip.status === TripStatus.PLANNED && new Date(props.trip.startDate) > new Date()
})

const formattedDates = computed(() => {
  if (!props.trip)
    return ''

  const start = new Date(props.trip.startDate)
  const end = new Date(props.trip.endDate)

  const formatter = new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
  })

  if (start.getFullYear() === end.getFullYear())
    return `${formatter.format(start)} - ${formatter.format(end)} ${start.getFullYear()}`
  else
    return `${formatter.format(start)} ${start.getFullYear()} - ${formatter.format(end)} ${end.getFullYear()}`
})

const tripDurationDays = computed(() => {
  if (!props.trip)
    return 0
  const start = new Date(props.trip.startDate)
  const end = new Date(props.trip.endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays
})

const attractionCount = computed(() => {
  if (!props.days)
    return 0
  return props.days.reduce((total, day) => {
    return total + day.activities.filter(activity => activity.tag === EActivityTag.ATTRACTION).length
  }, 0)
})

const visibleParticipants = computed(() => props.trip?.participants.slice(0, 5) || [])
const hiddenParticipantsCount = computed(() => Math.max(0, (props.trip?.participants.length || 0) - 5))

// Информация о статусе
const statusInfo = computed(() => {
  if (!props.trip)
    return {}
  switch (props.trip.status) {
    case 'completed':
      return { text: 'Завершено', class: 'completed', icon: 'mdi:check-circle-outline' }
    case 'planned':
      return { text: 'Запланировано', class: 'planned', icon: 'mdi:calendar-check-outline' }
    default:
      return { text: 'Черновик', class: 'draft', icon: 'mdi:pencil-circle-outline' }
  }
})

// Форматирование бюджета
const formattedBudget = computed(() => {
  if (!props.trip || !props.trip.budget || !props.trip.currency)
    return null

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: props.trip.currency,
    minimumFractionDigits: 0,
  }).format(props.trip.budget)
})

function navigateToDay(dayId: string) {
  router.push({ query: { day: dayId } })
}

function navigateToSection(sectionId: string) {
  router.push({ query: { section: sectionId } })
}

// --- Функции для контролов ---
function handleEditTrip() {
  emit('edit')
}

async function handleDeleteTrip() {
  const isConfirmed = await confirm({
    title: 'Удалить путешествие?',
    description: 'Это действие необратимо. Все дни, планы и воспоминания будут удалены.',
    type: 'danger',
    confirmText: 'Удалить',
  })
  if (isConfirmed)
    await emit('delete')
}

const moreMenuItems = computed((): KitDropdownItem<string>[] => {
  const items: KitDropdownItem<string>[] = [
    { value: 'share', label: 'Поделиться', icon: 'mdi:share-variant-outline' },
  ]
  if (canEdit.value) {
    items.unshift({ value: 'edit', label: 'Редактировать', icon: 'mdi:pencil-outline' })
    items.push({ value: 'delete', label: 'Удалить', icon: 'mdi:trash-can-outline', isDestructive: true })
  }
  return items
})

function handleMenuAction(action: string) {
  if (action === 'edit')
    handleEditTrip()
  else if (action === 'delete')
    handleDeleteTrip()
}
</script>

<template>
  <div v-if="trip" class="trip-overview">
    <!-- Блок-обложка в стиле travel-card -->
    <div class="overview-banner">
      <KitImage
        v-if="trip.imageUrl"
        :src="trip.imageUrl"
        :alt="trip.title"
        class="banner-image"
      />
      <div v-else class="cover-placeholder">
        <Icon icon="mdi:map-legend" />
      </div>
      <div class="banner-overlay" />

      <div class="card-actions">
        <KitDropdown
          v-model:open="isMoreMenuOpen"
          align="end"
          :items="moreMenuItems"
          @update:model-value="handleMenuAction"
        >
          <template #trigger>
            <button class="action-btn" title="Еще" @click.stop.prevent>
              <Icon icon="mdi:dots-vertical" />
            </button>
          </template>
        </KitDropdown>
      </div>

      <div class="banner-content">
        <h1 class="trip-title">
          {{ trip.title }}
        </h1>
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

      <!-- Футер баннера с эффектом матового стекла -->
      <div class="banner-footer">
        <!-- Левая часть: мета-информация и теги -->
        <div class="footer-meta-content">
          <div class="trip-extra-meta">
            <div class="meta-item meta-item--status" :class="statusInfo.class">
              <Icon v-if="statusInfo.icon" :icon="statusInfo.icon" />
              <span>{{ statusInfo.text }}</span>
            </div>
            <div v-if="formattedBudget" class="meta-item">
              <Icon icon="mdi:wallet-outline" />
              <span>{{ formattedBudget }}</span>
            </div>
          </div>

          <div class="trip-participants">
            <KitAnimatedTooltip
              v-for="participant in visibleParticipants"
              :key="participant.id"
              :name="participant.name"
              :offset="10"
            >
              <KitAvatar
                :name="participant.name"
                :src="participant.avatarUrl"
                :size="36"
              />
            </KitAnimatedTooltip>
            <KitAvatar
              v-if="hiddenParticipantsCount > 0"
              is-more
              :size="36"
            >
              +{{ hiddenParticipantsCount }}
            </KitAvatar>
          </div>
        </div>

        <div v-if="trip.tags?.length" class="trip-tags">
          <span v-for="tag in trip.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <!-- Описание путешествия -->
    <div v-if="trip.description" class="trip-description-summary">
      <p>{{ trip.description }}</p>
    </div>

    <!-- Виджеты -->
    <div class="info-widgets">
      <StatsWidget
        :duration-days="tripDurationDays"
        :city-count="trip.cities.length"
        :participant-count="trip.participants.length"
        :attraction-count="attractionCount"
        @show-days="isDaysDialogVisible = true"
        @show-cities="isCitiesDialogVisible = true"
        @show-participants="isParticipantsDialogVisible = true"
        @show-attractions="isAttractionsDialogVisible = true"
      />
      <WeatherWidget
        v-if="trip.cities.length > 0"
        :cities="trip.cities"
        :start-date="trip.startDate"
      />
    </div>

    <!-- Сетки с днями и разделами -->
    <div class="overview-grid">
      <div class="overview-section">
        <h2 class="section-title">
          <Icon icon="mdi:calendar-month-outline" />
          <span>Дни путешествия</span>
        </h2>
        <ul v-if="days.length" class="items-list">
          <li
            v-for="(day, index) in days"
            :key="day.id"
            class="list-item day-item"
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="navigateToDay(day.id)"
          >
            <div class="item-main-info">
              <span class="day-number">{{ index + 1 }}</span>
              <div class="item-content">
                <span class="item-title">{{ day.title || `День ${index + 1}` }}</span>
                <span class="item-meta">{{ new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }) }}</span>
              </div>
            </div>
            <Icon icon="mdi:chevron-right" class="chevron-icon" />
          </li>
        </ul>
        <div v-else class="empty-list-placeholder">
          <p>Дни еще не добавлены в это путешествие.</p>
        </div>
      </div>

      <div class="overview-section">
        <h2 class="section-title">
          <Icon icon="mdi:file-document-multiple-outline" />
          <span>Разделы</span>
        </h2>
        <ul v-if="sections.length" class="items-list">
          <li
            v-for="(section, index) in sections"
            :key="section.id"
            class="list-item section-item"
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="navigateToSection(section.id)"
          >
            <div class="item-main-info">
              <Icon :icon="section.icon || 'mdi:file-outline'" class="section-icon" />
              <span class="item-title">{{ section.title }}</span>
            </div>
            <Icon icon="mdi:chevron-right" class="chevron-icon" />
          </li>
        </ul>
        <div v-else class="empty-list-placeholder">
          <p>Дополнительные разделы еще не созданы.</p>
        </div>
      </div>
    </div>

    <KitDivider
      v-if="isTripUpcoming"
    >
      <Icon icon="mdi:star-four-points-outline" />
    </KitDivider>
    <CountdownWidget
      v-if="isTripUpcoming"
      :target-date="trip.startDate"
      class="countdown"
    />

    <!-- Dialogs -->
    <DaysListDialog v-model:visible="isDaysDialogVisible" :days="days" @navigate="navigateToDay" />
    <CitiesListDialog v-model:visible="isCitiesDialogVisible" :cities="trip.cities" />
    <ParticipantsListDialog v-model:visible="isParticipantsDialogVisible" :participants="trip.participants" />
    <AttractionsListDialog v-model:visible="isAttractionsDialogVisible" :days="days" @navigate="navigateToDay" />
  </div>
</template>

<style scoped lang="scss">
.info-widget-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.trip-overview {
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.overview-banner,
.trip-description-summary,
.info-widgets,
.overview-grid,
.countdown {
  animation: fadeInUp 0.5s 0.1s ease-out forwards;
  opacity: 0;
}

.trip-description-summary {
  animation-delay: 0.2s;
}
.info-widgets {
  animation-delay: 0.3s;
}
.overview-grid {
  animation-delay: 0.4s;
}
.countdown {
  animation-delay: 0.5s;
}

.overview-banner {
  position: relative;
  height: 380px;
  border-radius: var(--r-l);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;

  .banner-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .banner-image :deep(.image) {
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  &:hover .banner-image :deep(.image) {
    transform: scale(1.05);
  }

  .cover-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    font-size: 64px;
    opacity: 0.5;
  }

  .banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 70%);
    z-index: 1;
  }

  .banner-content {
    position: relative;
    z-index: 2;
    color: rgba(var(--fg-secondary-color-rgb), 0.85);
    background: linear-gradient(0deg, rgba(var(--bg-secondary-color-rgb), 0.7) 0%, transparent 100%);

    text-shadow:
      1px 1px 0 rgba(var(--bg-tertiary-color-rgb), 0.5),
      -1px -1px 0 rgba(var(--bg-tertiary-color-rgb), 0.5),
      1px -1px 0 rgba(var(--bg-tertiary-color-rgb), 0.5),
      -1px 1px 0 rgba(var(--bg-tertiary-color-rgb), 0.5),
      0 2px 8px rgba(0, 0, 0, 0.7);

    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    padding-top: 64px;
    padding-bottom: 8px;

    & > * {
      animation: fadeInUp 0.6s 0.2s ease-out forwards;
      opacity: 0;
    }

    .trip-title {
      font-size: 2rem;
      line-height: 1.2;
      font-weight: 700;
      margin: 0;
    }

    .trip-meta {
      animation-delay: 0.3s;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
      }
    }
  }
}

.banner-footer {
  position: relative;
  z-index: 2;
  background-color: rgba(var(--bg-primary-color-rgb), 0.4);
  backdrop-filter: blur(10px);
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  @include media-down(sm) {
    padding: 1rem;
    flex-direction: column;
    align-items: flex-start;
  }
}

.footer-meta-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 1rem;
}

.trip-extra-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  color: var(--fg-primary-color);

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .meta-item--status {
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--r-s);

    &.completed {
      color: #28a745;
      background-color: rgba(40, 167, 69, 0.15);
    }
    &.planned {
      color: #d97706;
      background-color: rgba(217, 119, 6, 0.15);
    }
    &.draft {
      color: #6c757d;
      background-color: rgba(108, 117, 125, 0.15);
    }
  }
}

.trip-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .tag {
    background-color: rgba(var(--bg-tertiary-color-rgb), 0.4);
    color: var(--fg-secondary-color);
    padding: 2px 8px;
    border-radius: var(--r-full);
    font-size: 0.7rem;
    font-weight: 500;
  }
}

.trip-participants {
  display: flex;
  flex-shrink: 0;
  align-self: center;

  :deep(.kit-avatar) {
    transition: transform 0.2s ease;

    &:first-child {
      margin-left: 0;
    }

    &:hover {
      transform: translateY(-4px);
      z-index: 10;
    }
  }
}

.card-actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  z-index: 3;

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
    color: var(--fg-primary-color);
    border: none;
    border-radius: var(--r-full);
    cursor: pointer;
    backdrop-filter: blur(4px);
    transition: all 0.2s ease;

    &:hover {
      background-color: var(--bg-hover-color);
      transform: scale(1.1);
      color: var(--fg-accent-color);
    }
  }
}

.trip-description-summary {
  padding: 1rem;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  color: var(--fg-secondary-color);
  font-size: 0.95rem;
  line-height: 1.6;
}

.info-widgets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.overview-grid {
  display: grid;
  gap: 1.5rem;
  align-items: start;
}

.overview-section {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0.5rem 0.5rem 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);

  .iconify {
    color: var(--fg-accent-color);
  }
}

.items-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 12px 8px;
  border-radius: var(--r-m);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 1px solid transparent;

  animation: fadeInUp 0.4s ease-out forwards;
  opacity: 0;

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--border-primary-color);
    transform: translateX(4px);
  }
}

.item-main-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.item-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.item-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-s);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-weight: 600;
  flex-shrink: 0;
}

.item-meta {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  margin-left: auto;
  padding-left: 1rem;
  flex-shrink: 0;
}

.section-icon {
  font-size: 1.25rem;
  color: var(--fg-secondary-color);
}

.chevron-icon {
  color: var(--fg-tertiary-color);
}

.empty-list-placeholder {
  text-align: center;
  padding: 2rem;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
}

@include media-down(md) {
  .trip-overview {
    gap: 1rem;
  }
  .overview-banner {
    height: auto;
    min-height: 300px;
  }
  .banner-content {
    padding: 1rem;
    gap: 0.5rem;
  }
  .trip-title {
    font-size: 1.5rem;
    line-height: 1.3;
  }
  .trip-meta {
    gap: 0.5rem 1rem;
    .meta-item {
      font-size: 0.85rem;
      gap: 0.25rem;
    }
  }
  .footer-meta-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .trip-participants {
    align-self: flex-start;
  }
  .info-widgets,
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .overview-section {
    padding: 0.75rem;
  }
  .section-title {
    font-size: 1.1rem;
    margin: 0.25rem 0.25rem 1rem;
    padding-bottom: 0.75rem;
  }
  .list-item {
    padding: 10px 6px;
    gap: 0.5rem;
  }
  .item-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .item-title {
    width: 100%;
  }
  .item-meta {
    font-size: 0.8rem;
    margin-left: 0;
    padding-left: 0;
  }
}
</style>
