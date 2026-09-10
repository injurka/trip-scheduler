<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { MapRoute } from '~/components/03.domain/trip-info/geolocation-section'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import type { OfflineDownloadOptions } from '~/shared/store/offline.store'
import type { Trip, TripSection, TripWeatherData } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { useClipboard, useShare } from '@vueuse/core'
import { DropdownMenuItem } from 'reka-ui'
import { KitAnimatedTooltip } from '~/components/01.kit/kit-animated-tooltip'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { OfflineDownloadDialog } from '~/components/02.shared/offline-manager'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'
import { vRipple } from '~/shared/directives/ripple'
import { calculateTripBoundingBox } from '~/shared/lib/tile-calc'
import { useOfflineStore } from '~/shared/store/offline.store'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'
import { TripStatus } from '~/shared/types/models/trip'
import { exportToMapsMe } from '../lib/mapsme-export'
import CountdownWidget from './content/countdown-widget.vue'
import TripMapWidget from './content/map-widget.vue'
import StatsWidget from './content/stats-widget.vue'

import WeatherWidget from './content/weather-widget.vue'

import {
  AttractionsListDialog,
  CitiesListDialog,
  DaysListDialog,
  ExportTripDialog,
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
const toast = useToast()
const appStore = useAppStore(['auth', 'notif'])
const { canEdit } = useTripPermissions()
const { share, isSupported: isShareSupported } = useShare()
const { copy } = useClipboard()
const offlineStore = useOfflineStore()
const moduleStore = useModuleStore(['plan', 'ui'])
const { isViewMode } = storeToRefs(moduleStore.ui)
const isEditable = computed(() => canEdit.value && !isViewMode.value)

const isMoreMenuOpen = ref(false)

const isDaysDialogVisible = ref(false)
const isCitiesDialogVisible = ref(false)
const isParticipantsDialogVisible = ref(false)
const isAttractionsDialogVisible = ref(false)
const isExportDialogVisible = ref(false)
const isOfflineDownloadDialogVisible = ref(false)

const isDescriptionExpanded = ref(false)
const descriptionShortText = ref('')
const descriptionFullText = ref('')
const isMobileTagsOpen = ref(false)

function formatTag(tag: string): string {
  if (!tag)
    return ''

  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
}

watch(
  () => props.trip,
  (newTrip) => {
    descriptionShortText.value = newTrip?.descriptionShort || newTrip?.description || ''
    descriptionFullText.value = newTrip?.description || ''
    isMobileTagsOpen.value = false
  },
  { immediate: true, deep: true },
)

const hasExpandableDescription = computed(
  () => !!props.trip?.descriptionShort && !!props.trip?.description,
)

const isTripUpcoming = computed(() => {
  if (!props.trip)
    return false

  return props.trip.status === TripStatus.PLANNED && new Date(props.trip.startDate) > new Date()
})

const isSubscribedToCurrentTrip = computed(() => {
  return props.trip ? appStore.notif.isSubscribedToTrip(props.trip.id) : false
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

function getRussianPlural(count: number, titles: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2]
  const index = count % 100 > 4 && count % 100 < 20 ? 2 : cases[count % 10 < 5 ? count % 10 : 5]
  return titles[index]
}

const tripDurationDays = computed(() => {
  if (!props.trip)
    return 0
  const start = new Date(props.trip.startDate)
  const end = new Date(props.trip.endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays
})

const formattedDuration = computed(() => {
  if (!tripDurationDays.value)
    return ''
  const label = getRussianPlural(tripDurationDays.value, ['день', 'дня', 'дней'])
  return `${tripDurationDays.value} ${label}`
})

const formattedCities = computed(() => {
  if (!props.trip?.cities?.length)
    return ''
  return props.trip.cities.join(' · ')
})

const citiesSummary = computed(() => {
  if (!props.trip?.cities?.length)
    return { first: '', count: 0, hasMore: false }
  const first = props.trip.cities[0]
  const count = props.trip.cities.length
  return {
    first,
    count,
    hasMore: count > 1,
    moreCount: count - 1,
  }
})

const overviewCalendarDays = computed(() =>
  props.days
    .filter(d => !!d.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
)

const overviewDraftDays = computed(() =>
  props.days.filter(d => !d.date),
)

const attractionCount = computed(() => {
  if (!props.days)
    return 0
  return props.days.reduce((total, day) => {
    return total + day.activities.filter(activity => activity.tag === EActivityTag.ATTRACTION).length
  }, 0)
})

const allGeoSections = computed(() => {
  const sections: { section: any, activityTag: string | null }[] = []
  props.days.forEach((day) => {
    day.activities.forEach((activity) => {
      activity.sections?.forEach((section) => {
        if (section.type === EActivitySectionType.GEOLOCATION) {
          sections.push({ section, activityTag: activity.tag || null })
        }
      })
    })
  })
  return sections
})

const allPoints = computed<any[]>(() =>
  allGeoSections.value.flatMap(s =>
    (s.section.points || []).map((p: any) => ({ ...p, activityTag: s.activityTag })),
  ),
)
const allRoutes = computed<MapRoute[]>(() =>
  allGeoSections.value.flatMap(s => s.section.routes || []),
)

const hasCoordinates = computed(() => {
  if (!props.trip)
    return false
  return (
    allPoints.value.length > 0
    || allRoutes.value.length > 0
    || Boolean(calculateTripBoundingBox({
      ...props.trip,
      days: props.days,
      sections: props.sections,
    }))
  )
})

const visibleParticipants = computed(() => props.trip?.participants.slice(0, 5) || [])
const hiddenParticipantsCount = computed(() => Math.max(0, (props.trip?.participants.length || 0) - 5))

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

const visibilityInfo = computed(() => {
  if (!props.trip)
    return { icon: 'mdi:lock-outline', label: 'Приватное' }

  switch (props.trip.visibility) {
    case 'public':
      return { icon: 'mdi:earth', label: 'Публичное путешествие' }
    case 'private':
      return { icon: 'mdi:account-multiple-outline', label: 'Доступно по ссылке' }
    default:
      return { icon: 'mdi:lock-outline', label: 'Приватное путешествие' }
  }
})

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

function navigateToProfile(userId: string) {
  router.push(AppRoutePaths.User.Profile(userId))
}

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

function handleWeatherUpdated(data: TripWeatherData) {
  if (moduleStore.plan.trip) {
    moduleStore.plan.trip.weatherData = data
  }
}

const isCached = computed(() => props.trip && offlineStore.isTripCached(props.trip.id))
const isDownloading = computed(() => props.trip && offlineStore.isTripDownloading(props.trip.id))
const progress = computed(() => props.trip ? offlineStore.getDownloadProgress(props.trip.id) : 0)

const moreMenuItems = computed((): KitDropdownItem<string>[] => {
  const items: KitDropdownItem<string>[] = [
    { value: 'export', label: 'Экспорт', icon: 'mdi:export-variant' },
    { value: 'export_mapsme', label: 'Импорт в Maps.me', icon: 'mdi:map-legend' },
    { value: 'share', label: 'Поделиться', icon: 'mdi:share-variant-outline' },
  ]

  if (isDownloading.value) {
    items.push({
      value: 'downloading',
      label: `Загрузка ${progress.value}%...`,
      icon: 'mdi:loading',
    })
  }
  else if (isCached.value) {
    items.push({ value: 'update_offline', label: 'Обновить оффлайн', icon: 'mdi:cloud-refresh' })
  }
  else {
    items.push({ value: 'save_offline', label: 'Сохранить оффлайн', icon: 'mdi:cloud-download-outline' })
  }

  if (isSubscribedToCurrentTrip.value) {
    items.push({
      value: 'unsubscribe_trip',
      label: 'Не следить',
      icon: 'mdi:bell-off-outline',
    })
  }
  else {
    items.push({
      value: 'subscribe_trip',
      label: 'Следить за поездкой',
      icon: 'mdi:bell-plus-outline',
    })
  }

  if (canEdit.value) {
    items.unshift({ value: 'edit', label: 'Редактировать', icon: 'mdi:pencil-outline' })
    items.push({ value: 'delete', label: 'Удалить', icon: 'mdi:trash-can-outline', isDestructive: true })
  }
  return items
})

async function handleMenuAction(action: string) {
  if (action === 'share') {
    const shareData = {
      title: props.trip?.title || 'Путешествие',
      text: props.trip?.description || `Взгляните на план путешествия "${props.trip?.title}"`,
      url: window.location.href,
    }

    if (isShareSupported.value) {
      try {
        await share(shareData)
      }
      catch {
      }
    }
    else {
      await copy(shareData.url)
      toast.success('Ссылка скопирована в буфер обмена')
    }
  }
  else if (action === 'subscribe_trip' && props.trip) {
    await appStore.notif.subscribeToTrip(props.trip.id)
  }
  else if (action === 'unsubscribe_trip' && props.trip) {
    await appStore.notif.unsubscribeFromTrip(props.trip.id)
  }
  else if (action === 'edit') {
    handleEditTrip()
  }
  else if (action === 'delete') {
    handleDeleteTrip()
  }
  else if (action === 'export') {
    isExportDialogVisible.value = true
  }
  else if (action === 'export_mapsme') {
    try {
      exportToMapsMe(props.trip, allPoints.value, allRoutes.value)
      toast.success('Файл успешно подготовлен и скачан')
    }
    catch {
      toast.error('Произошла ошибка при экспорте гео-данных')
    }
  }
  else if (action === 'save_offline' || action === 'update_offline') {
    isOfflineDownloadDialogVisible.value = true
  }

  isMoreMenuOpen.value = false
}

async function handleConfirmOfflineDownload(options: OfflineDownloadOptions) {
  if (moduleStore.plan.trip) {
    const fullTripData = {
      ...moduleStore.plan.trip,
      days: props.days,
      sections: props.sections,
    }
    await offlineStore.saveTripForOffline(fullTripData, options)
  }
}

onMounted(() => {
  if (props.trip?.id && appStore.auth.isAuthenticated) {
    appStore.notif.checkTripSubscription(props.trip.id)
  }
})

watch(() => props.trip?.id, (newId) => {
  if (newId && appStore.auth.isAuthenticated)
    appStore.notif.checkTripSubscription(newId)
})
</script>

<template>
  <div v-if="trip" class="trip-overview">
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

      <!-- Верхняя панель: статус приватности слева, меню действий справа -->
      <div class="header-actions-wrapper">
        <KitTooltip :text="visibilityInfo.label">
          <div class="card-visibility-pill">
            <Icon :icon="visibilityInfo.icon" class="visibility-icon" />
            <span class="visibility-text">{{ visibilityInfo.label }}</span>
          </div>
        </KitTooltip>

        <div class="card-actions" @click.stop>
          <KitTooltip text="Еще">
            <KitDropdown
              v-model:open="isMoreMenuOpen"
              align="end"
            >
              <template #trigger>
                <button class="action-btn" aria-label="Еще действия">
                  <Icon icon="mdi:dots-vertical" />
                </button>
              </template>
              <DropdownMenuItem
                v-for="item in moreMenuItems"
                :key="item.value"
                class="kit-dropdown-item"
                :class="{ 'is-destructive': item.isDestructive }"
                :disabled="item.value === 'downloading'"
                @click="handleMenuAction(item.value)"
              >
                <Icon v-if="item.icon" :icon="item.icon" class="item-icon" :class="{ 'spin-icon': item.value === 'downloading' }" />
                <span class="item-label">{{ item.label }}</span>
              </DropdownMenuItem>
            </KitDropdown>
          </KitTooltip>
        </div>
      </div>

      <!-- Главный информационный блок: заголовок, метаданные, статусы, теги и участники -->
      <div class="banner-body">
        <!-- Название путешествия -->
        <h1 class="trip-title">
          {{ trip.title }}
        </h1>

        <!-- Мета-информация: даты, длительность, города, бюджет -->
        <div class="trip-meta-row">
          <div class="meta-item meta-item--dates">
            <Icon icon="mdi:calendar-month-outline" />
            <span>{{ formattedDates }}</span>
            <span v-if="formattedDuration" class="duration-badge">
              {{ formattedDuration }}
            </span>
          </div>

          <div
            v-if="trip.cities.length"
            class="meta-item meta-item--cities"
            :class="{ 'is-clickable': citiesSummary.hasMore }"
            @click="citiesSummary.hasMore && (isCitiesDialogVisible = true)"
          >
            <Icon icon="mdi:map-marker-outline" />
            <span class="cities-text" :title="trip.cities.join(', ')">
              <span class="cities-full">{{ formattedCities }}</span>
              <span class="cities-compact">{{ citiesSummary.first }}</span>
            </span>
            <span v-if="citiesSummary.hasMore" class="cities-more-badge">
              +{{ citiesSummary.moreCount }}
            </span>
          </div>

          <div v-if="formattedBudget" class="meta-item meta-item--budget">
            <Icon icon="mdi:wallet-outline" />
            <span>{{ formattedBudget }}</span>
          </div>
        </div>

        <!-- Нижний ряд: Статусы и Теги слева, Аватары участников справа -->
        <div class="banner-bottom-row">
          <div class="banner-bottom-left">
            <!-- Статусы: Запланировано / Оффлайн / Загрузка -->
            <div class="banner-status-line">
              <div class="status-pill" :class="statusInfo.class">
                <Icon v-if="statusInfo.icon" :icon="statusInfo.icon" class="status-icon" />
                <span>{{ statusInfo.text }}</span>
              </div>

              <KitTooltip v-if="isCached" text="Путешествие сохранено для оффлайн доступа">
                <div class="status-pill status-pill--offline">
                  <Icon icon="mdi:cloud-check" />
                  <span>Оффлайн</span>
                </div>
              </KitTooltip>

              <div v-if="isDownloading" class="status-pill status-pill--downloading">
                <Icon icon="mdi:loading" class="spin-icon" />
                <span>Загрузка {{ progress }}%</span>
              </div>
            </div>

            <!-- Мобильная кнопка показа тегов: справа от статусов -->
            <button
              v-if="trip.tags?.length"
              type="button"
              class="mobile-tags-toggle-btn"
              :class="{ 'is-active': isMobileTagsOpen }"
              :aria-expanded="isMobileTagsOpen"
              @click.stop="isMobileTagsOpen = !isMobileTagsOpen"
            >
              <span>Теги</span>
              <Icon :icon="isMobileTagsOpen ? 'mdi:minus' : 'mdi:plus'" class="toggle-icon" />
            </button>

            <div v-if="trip.tags?.length" class="trip-tags">
              <span v-for="tag in trip.tags" :key="tag" v-ripple class="tag">#{{ formatTag(tag) }}</span>
            </div>
          </div>

          <div v-if="trip.participants.length" class="trip-participants">
            <KitAnimatedTooltip
              v-for="participant in visibleParticipants"
              :key="participant.id"
              :name="participant.name"
              :offset="10"
            >
              <KitAvatar
                :name="participant.name"
                :src="participant.avatarUrl"
                :size="34"
                class="clickable-avatar"
                @click.stop="navigateToProfile(participant.id)"
              />
            </KitAnimatedTooltip>
            <KitAvatar
              v-if="hiddenParticipantsCount > 0"
              is-more
              :size="34"
            >
              +{{ hiddenParticipantsCount }}
            </KitAvatar>
          </div>
        </div>
      </div>
    </div>

    <!-- Мобильная полоса тегов вне баннера, если они есть и раскрыты -->
    <Transition name="tags-expand">
      <div v-if="trip.tags?.length && isMobileTagsOpen" class="mobile-trip-tags">
        <span v-for="tag in trip.tags" :key="tag" v-ripple class="tag">#{{ formatTag(tag) }}</span>
      </div>
    </Transition>

    <div
      v-if="trip.descriptionShort || trip.description"
      class="trip-description-summary"
    >
      <KitInlineMdEditorWrapper
        :key="`desc-short-${trip.id}`"
        v-model="descriptionShortText"
        :readonly="true"
        class="description-md-view description-md-view--short"
      />

      <Transition name="description-expand">
        <div v-if="isDescriptionExpanded" class="description-expand-container">
          <div class="description-full-wrapper">
            <div class="description-separator" />
            <KitInlineMdEditorWrapper
              :key="`desc-full-${trip.id}`"
              v-model="descriptionFullText"
              :readonly="true"
              class="description-md-view description-md-view--full"
            />
          </div>
        </div>
      </Transition>

      <button
        v-if="hasExpandableDescription"
        class="description-toggle-btn"
        @click="isDescriptionExpanded = !isDescriptionExpanded"
      >
        <span>{{ isDescriptionExpanded ? 'Свернуть' : 'Подробнее' }}</span>
        <Icon
          :icon="isDescriptionExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          class="toggle-icon"
        />
      </button>
    </div>

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
        :trip-id="trip.id"
        :weather-data="trip.weatherData"
        :is-editable="isEditable"
        @weather-updated="handleWeatherUpdated"
      />
    </div>

    <div class="overview-grid">
      <div class="overview-section">
        <h2 class="section-title">
          <Icon icon="mdi:calendar-month-outline" />
          <span>Дни путешествия</span>
        </h2>
        <ul v-if="overviewCalendarDays.length" class="items-list">
          <li
            v-for="(day, index) in overviewCalendarDays"
            :key="day.id"
            v-ripple
            class="list-item day-item"
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="navigateToDay(day.id)"
          >
            <div class="item-main-info">
              <span class="day-number">{{ index + 1 }}</span>
              <div class="item-content">
                <span class="item-title">{{ day.title || `День ${index + 1}` }}</span>
                <span class="item-meta">{{ new Date(day.date!).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }) }}</span>
              </div>
            </div>
            <Icon icon="mdi:chevron-right" class="chevron-icon" />
          </li>
        </ul>
        <div v-else class="empty-list-placeholder">
          <p>Календарные дни еще не добавлены в это путешествие.</p>
        </div>

        <template v-if="overviewDraftDays.length">
          <h2 class="section-title drafts-overview-title">
            <Icon icon="mdi:file-document-edit-outline" />
            <span>Черновики и варианты</span>
          </h2>
          <ul class="items-list">
            <li
              v-for="(day, index) in overviewDraftDays"
              :key="day.id"
              v-ripple
              class="list-item day-item day-item--draft"
              :style="{ animationDelay: `${index * 50}ms` }"
              @click="navigateToDay(day.id)"
            >
              <div class="item-main-info">
                <span class="day-number day-number--draft">
                  <Icon icon="mdi:map-marker-path" />
                </span>
                <div class="item-content">
                  <span class="item-title">{{ day.title || `Черновик ${index + 1}` }}</span>
                  <span class="item-meta">Без даты (Черновик)</span>
                </div>
              </div>
              <Icon icon="mdi:chevron-right" class="chevron-icon" />
            </li>
          </ul>
        </template>
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

    <TripMapWidget
      v-if="allPoints.length > 0 || allRoutes.length > 0 || trip.cities.length > 0"
      :points="allPoints"
      :routes="allRoutes"
      :cities="trip.cities"
    />

    <KitDivider v-if="isTripUpcoming">
      <Icon icon="mdi:star-four-points-outline" />
    </KitDivider>
    <CountdownWidget
      v-if="isTripUpcoming"
      :target-date="trip.startDate"
      class="countdown"
    />

    <DaysListDialog v-model:visible="isDaysDialogVisible" :days="days" @navigate="navigateToDay" />
    <CitiesListDialog v-model:visible="isCitiesDialogVisible" :cities="trip.cities" />
    <ParticipantsListDialog v-model:visible="isParticipantsDialogVisible" :participants="trip.participants" />
    <AttractionsListDialog v-model:visible="isAttractionsDialogVisible" :days="days" @navigate="navigateToDay" />
    <ExportTripDialog v-model:visible="isExportDialogVisible" :trip="trip" :days="days" :sections="sections" />
    <OfflineDownloadDialog
      v-model:visible="isOfflineDownloadDialogVisible"
      :trip-title="trip?.title"
      :has-coordinates="hasCoordinates"
      @confirm="handleConfirmOfflineDownload"
    />
  </div>
</template>

<style scoped lang="scss">
.clickable-avatar {
  cursor: pointer;
}
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
.trip-map-widget,
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
.trip-map-widget {
  animation-delay: 0.45s;
}
.countdown {
  animation-delay: 0.5s;
}

.overview-banner {
  position: relative;
  min-height: 400px;
  border-radius: var(--r-l);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);

  .banner-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .banner-image :deep(.image) {
    transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @include hover {
    & .banner-image :deep(.image) {
      transform: scale(1.04);
    }
  }

  .cover-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 40%, var(--bg-secondary-color) 0%, var(--bg-tertiary-color) 100%);
    color: var(--fg-secondary-color);
    font-size: 72px;
    opacity: 0.6;
  }

  /* Cinematic Scrim Gradient: soft dark vignettes for editorial photography (reduced darkness by 10%) */
  .banner-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.12) 30%, transparent 50%),
      linear-gradient(0deg, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.6) 35%, rgba(0, 0, 0, 0.25) 65%, transparent 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Top Toolbar Actions */
  .header-actions-wrapper {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .card-visibility-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(15, 15, 20, 0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--r-full);
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: default;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;

    .visibility-icon {
      font-size: 1rem;
      opacity: 0.9;
    }

    &:hover {
      background: rgba(25, 25, 35, 0.75);
      border-color: rgba(255, 255, 255, 0.25);
    }
  }

  .card-actions {
    display: flex;

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      background: rgba(15, 15, 20, 0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      border-radius: var(--r-full);
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      @include hover {
        & {
          background: rgba(40, 40, 55, 0.85);
          border-color: rgba(255, 255, 255, 0.35);
          color: #ffffff;
          transform: translateY(-1px);
        }
      }
    }
  }

  /* Main Editorial Body */
  .banner-body {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 1.5rem 1.75rem 1.5rem;

    & > * {
      animation: fadeInUp 0.5s 0.15s ease-out forwards;
      opacity: 0;
    }
  }

  /* Status badges line */
  .banner-status-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

    .status-icon {
      font-size: 0.95rem;
    }

    &.completed {
      color: #4ade80;
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(74, 222, 128, 0.35);
    }

    &.planned {
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(251, 191, 36, 0.35);
    }

    &.draft {
      color: #cbd5e1;
      background: rgba(148, 163, 184, 0.2);
      border: 1px solid rgba(203, 213, 225, 0.3);
    }

    &--offline {
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.2);
      border: 1px solid rgba(56, 189, 248, 0.35);
    }

    &--downloading {
      color: #f472b6;
      background: rgba(236, 72, 153, 0.2);
      border: 1px solid rgba(244, 114, 182, 0.35);

      .spin-icon {
        animation: spin 1s linear infinite;
      }
    }
  }

  .mobile-tags-toggle-btn {
    display: none;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #ffffff;
    cursor: pointer;
    font-family: inherit;
    line-height: 1.2;
    transition: all 0.2s ease;
    user-select: none;

    .toggle-icon {
      font-size: 0.85rem;
      transition: transform 0.2s ease;
    }

    &.is-active {
      background: rgba(255, 255, 255, 0.28);
      border-color: rgba(255, 255, 255, 0.45);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  /* Editorial Title */
  .trip-title {
    font-size: 2.25rem;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    margin: 0;
    word-break: break-word;
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
  }

  /* Meta Row: Dates, Duration, Cities, Budget */
  .trip-meta-row {
    animation-delay: 0.25s;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem 1.5rem;
    color: rgba(255, 255, 255, 0.92);

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.92rem;
      font-weight: 500;
      letter-spacing: 0.01em;

      svg {
        font-size: 1.1rem;
        opacity: 0.85;
      }

      .duration-badge {
        display: inline-flex;
        align-items: center;
        margin-left: 0.25rem;
        padding: 2px 8px;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: var(--r-full);
        font-size: 0.75rem;
        font-weight: 600;
        color: #ffffff;
        letter-spacing: 0.02em;
      }

      &--budget {
        background: rgba(255, 255, 255, 0.12);
        padding: 3px 10px;
        border-radius: var(--r-s);
        border: 1px solid rgba(255, 255, 255, 0.18);
        font-weight: 600;
        color: #ffffff;
        margin-left: auto;
      }

      &--cities {
        .cities-compact {
          display: none;
        }

        .cities-full {
          display: inline;
        }

        .cities-text {
          max-width: 380px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        &.is-clickable {
          cursor: pointer;
          transition: opacity 0.2s ease;

          &:hover {
            opacity: 0.85;
          }
        }

        .cities-more-badge {
          display: none;
          align-items: center;
          padding: 1px 7px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: var(--r-full);
          font-size: 0.72rem;
          font-weight: 600;
          color: #ffffff;
        }
      }
    }
  }

  /* Bottom Row: Statuses, Tags and Participants */
  .banner-bottom-row {
    animation-delay: 0.35s;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .banner-bottom-left {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    flex: 1;
    min-width: 0;
  }

  .trip-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;

    .tag {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      padding: 3px 10px;
      border-radius: var(--r-full);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      transition: all 0.2s ease;

      @include hover {
        & {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.3);
        }
      }
    }
  }

  .trip-participants {
    display: flex;
    align-items: center;
    flex-shrink: 0;

    :deep(.kit-avatar) {
      margin-left: -8px;
      border: 2px solid rgba(20, 20, 25, 0.85);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      transition:
        transform 0.2s ease,
        border-color 0.2s ease;

      &:first-child {
        margin-left: 0;
      }

      @include hover {
        & {
          transform: translateY(-3px) scale(1.08);
          border-color: #ffffff;
          z-index: 10;
        }
      }
    }
  }
}

.kit-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-xs);
  cursor: pointer;
  transition: background-color 0.2s ease;
  outline: none;
  font-size: 0.95rem;
  color: var(--fg-primary-color);

  &:hover,
  &[data-highlighted] {
    background-color: var(--bg-hover-color);
  }

  &.is-destructive {
    color: var(--fg-error-color);
    .item-icon {
      color: var(--fg-error-color);
    }
    &:hover,
    &[data-highlighted] {
      background-color: var(--bg-error-color);
      color: var(--fg-error-color);
      .item-icon {
        color: var(--fg-error-color);
      }
    }
  }

  &[disabled] {
    opacity: 0.6;
    cursor: default;
    &:hover {
      background: transparent;
    }
  }
}

.item-icon {
  color: var(--fg-secondary-color);
  font-size: 1.1rem;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.mobile-trip-tags {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;

  .tag {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: 0.75rem;
    font-weight: 500;
  }
}

.tags-expand-enter-active,
.tags-expand-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.tags-expand-enter-from,
.tags-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.trip-description-summary {
  animation-delay: 0.2s;
  padding: 1rem;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
}

.description-md-view {
  :deep(.milkdown) {
    > div {
      padding: 0;
    }
  }

  :deep(.ProseMirror) {
    cursor: default;
  }

  :deep(.milkdown div) {
    &:hover {
      background-color: transparent !important;
    }
  }
}

.description-md-view--short {
  :deep(.ProseMirror p) {
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0;
  }
}

.description-md-view--full {
  :deep(.ProseMirror p) {
    color: var(--fg-primary-color);
    font-size: 0.9rem;
    line-height: 1.7;
    margin: 0;
  }
}

.description-separator {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 0.25rem 0;
}

.description-toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 0.25rem;
  padding: 0;
  background: none;
  border: none;
  color: var(--fg-accent-color);
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s ease;
  align-self: flex-start;
  margin-left: auto;

  &:hover {
    opacity: 0.75;
  }

  .toggle-icon {
    font-size: 1rem;
    transition: transform 0.25s ease;
  }
}

.description-expand-container {
  display: grid;
  grid-template-rows: 1fr;
}

.description-full-wrapper {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.description-expand-enter-active {
  transition:
    grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}

.description-expand-leave-active {
  transition:
    grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease;
}

.description-expand-enter-from,
.description-expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.description-expand-enter-to,
.description-expand-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}

.info-widgets {
  display: flex;
  flex-direction: column;
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

  @include hover {
    & {
      background-color: var(--bg-hover-color);
      border-color: var(--border-primary-color);
      transform: translateX(4px);
    }
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

  &--draft {
    background-color: transparent;
    border: 1px dashed var(--border-secondary-color);
    color: var(--fg-secondary-color);
  }
}

.drafts-overview-title {
  margin-top: 1.5rem;
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
    min-height: 380px;

    .header-actions-wrapper {
      padding: 1rem;
    }

    .card-visibility-pill {
      width: 38px;
      height: 38px;
      padding: 0;
      justify-content: center;

      .visibility-text {
        display: none;
      }
    }

    .banner-body {
      padding: 1.25rem 1rem 1rem;
      gap: 10px;
    }

    .trip-title {
      font-size: 1.75rem;
      line-height: 1.2;
    }

    .trip-meta-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 0.5rem 0.75rem;

      .meta-item {
        font-size: 0.85rem;
      }

      .meta-item--dates {
        grid-column: 1 / -1;

        .duration-badge {
          margin-left: auto;
        }
      }

      .meta-item--cities {
        grid-column: 1 / 2;
        min-width: 0;

        .cities-full {
          display: none;
        }

        .cities-compact {
          display: inline;
        }

        .cities-more-badge {
          display: inline-flex;
        }
      }

      .meta-item--budget {
        grid-column: 2 / 3;
        margin-left: 0;
      }
    }

    .banner-bottom-row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .banner-bottom-left {
      flex: 1;
      min-width: 0;
      gap: 6px 10px;
    }

    .trip-tags {
      display: none;
    }

    .mobile-tags-toggle-btn {
      display: inline-flex;
    }

    .trip-participants {
      flex-shrink: 0;
    }
  }

  .mobile-trip-tags {
    display: flex;
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
