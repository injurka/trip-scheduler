<script setup lang="ts">
import type { TripWeatherData } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'

interface Props {
  cities: string[]
  startDate: string
  tripId?: string
  weatherData?: TripWeatherData | null
  isEditable?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'weatherUpdated', data: TripWeatherData): void
}>()

const planStore = useTripPlanStore()
const { ui } = useModuleStore(['ui'])
const { isViewMode } = storeToRefs(ui)
const { canEdit } = useTripPermissions()

const isEditMode = computed(() => {
  if (props.isEditable !== undefined)
    return props.isEditable
  return canEdit.value && !isViewMode.value
})

const selectedCity = ref<string | null>(null)
const isDropdownOpen = ref(false)
const isDetailsExpanded = ref(false)
const isGeneratingLocal = ref(false)
const errorMessage = ref<string | null>(null)

const isGenerating = computed(() => {
  return isGeneratingLocal.value || planStore.isGeneratingWeather
})

const cityOptions = computed(() => {
  return props.cities.map(city => ({
    value: city,
    label: city,
  }))
})

const MONTH_NAMES_PREPOSITIONAL: Record<number, string> = {
  0: 'январе',
  1: 'феврале',
  2: 'марте',
  3: 'апреле',
  4: 'мае',
  5: 'июне',
  6: 'июле',
  7: 'августе',
  8: 'сентябре',
  9: 'октябре',
  10: 'ноябре',
  11: 'декабре',
}

const monthName = computed(() => {
  if (!props.startDate)
    return ''
  const date = new Date(props.startDate)
  return MONTH_NAMES_PREPOSITIONAL[date.getMonth()] || date.toLocaleString('ru-RU', { month: 'long' })
})

const effectiveWeatherData = computed(() => {
  return props.weatherData || planStore.trip?.weatherData || null
})

const currentCityWeather = computed(() => {
  if (!selectedCity.value || !effectiveWeatherData.value)
    return null

  return effectiveWeatherData.value[selectedCity.value] || null
})

const hasDetailedInfo = computed(() => {
  if (!currentCityWeather.value)
    return false
  const w = currentCityWeather.value
  return Boolean(
    w.clothingRecommendation
    || w.summary
    || w.windDescription
    || w.seasonalityDescription
    || w.precipitationType
    || w.rainyDays,
  )
})

const rainDetailText = computed(() => {
  if (!currentCityWeather.value)
    return ''

  const { rainyDays, precipitationType } = currentCityWeather.value
  const parts: string[] = []

  if (rainyDays)
    parts.push(`${rainyDays} дн. с осадками`)

  if (precipitationType)
    parts.push(precipitationType)

  return parts.join(' • ')
})

function formatTemp(temp: number | null | undefined): string {
  if (temp === null || temp === undefined)
    return '—'
  const rounded = Math.round(temp)
  return rounded > 0 ? `+${rounded}°` : `${rounded}°`
}

function getSeasonalityLabel(level?: string | null): string {
  switch (level) {
    case 'low': return 'Низкая'
    case 'medium': return 'Умеренная'
    case 'high': return 'Высокая'
    case 'peak': return 'Пиковая'
    default: return level || 'Обычная'
  }
}

function getSeasonalityClass(level?: string | null): string {
  switch (level) {
    case 'low': return 'seasonality-low'
    case 'medium': return 'seasonality-medium'
    case 'high': return 'seasonality-high'
    case 'peak': return 'seasonality-peak'
    default: return 'seasonality-medium'
  }
}

async function handleGenerateWeather(forceRefresh = false) {
  if (!selectedCity.value)
    return

  errorMessage.value = null
  isGeneratingLocal.value = true

  try {
    const res = await planStore.generateWeather(selectedCity.value, forceRefresh)
    if (res?.weatherData) {
      emit('weatherUpdated', res.weatherData)
    }
  }
  catch (e: any) {
    console.error('Weather generation error:', e)
    errorMessage.value = e.message || 'Произошла ошибка при генерации погоды.'
  }
  finally {
    isGeneratingLocal.value = false
  }
}

async function handleGenerateAllCities(forceRefresh = false) {
  errorMessage.value = null
  isGeneratingLocal.value = true

  try {
    const res = await planStore.generateWeather(undefined, forceRefresh)
    if (res?.weatherData) {
      emit('weatherUpdated', res.weatherData)
    }
  }
  catch (e: any) {
    console.error('Weather generation error:', e)
    errorMessage.value = e.message || 'Произошла ошибка при генерации погоды.'
  }
  finally {
    isGeneratingLocal.value = false
  }
}

onMounted(() => {
  if (props.cities.length > 0) {
    selectedCity.value = props.cities[0]
  }
})
</script>

<template>
  <div class="info-widget-card weather-widget">
    <div class="widget-header">
      <div class="title-wrap">
        <Icon icon="mdi:weather-partly-cloudy" class="title-icon" />
        <h3 class="widget-title">
          Климат и погода в {{ monthName }}
        </h3>
      </div>

      <div class="header-actions">
        <button
          v-if="currentCityWeather && isEditMode"
          class="action-btn"
          :class="{ 'is-loading': isGenerating }"
          :disabled="isGenerating"
          title="Обновить контекст через AI"
          @click="handleGenerateWeather(true)"
        >
          <Icon :icon="isGenerating ? 'mdi:loading' : 'mdi:refresh'" :class="{ spin: isGenerating }" />
        </button>
      </div>
    </div>

    <!-- Селектор городов -->
    <div v-if="cities.length > 1" class="city-selector-container">
      <KitDropdown
        v-model="selectedCity"
        v-model:open="isDropdownOpen"
        :items="cityOptions"
        align="start"
      >
        <template #trigger>
          <button class="city-selector-wrapper">
            <Icon icon="mdi:city-variant-outline" />
            <span class="city-selector-text">
              {{ selectedCity || 'Выберите город' }}
            </span>
            <Icon icon="mdi:chevron-down" class="chevron-icon" :class="{ 'is-open': isDropdownOpen }" />
          </button>
        </template>
      </KitDropdown>
    </div>

    <div class="forecast-display">
      <!-- Состояние загрузки -->
      <div v-if="isGenerating" class="state-info">
        <div class="loading-icon-wrap">
          <Icon icon="mdi:creation" class="spin-slow" />
        </div>
        <span class="loading-title">Генерация климатического контекста...</span>
        <span class="loading-subtitle">Проверяем базу данных и формируем аналитику через AI</span>
      </div>

      <!-- Состояние ошибки -->
      <div v-else-if="errorMessage" class="state-info error">
        <Icon icon="mdi:alert-circle-outline" class="error-icon" />
        <span class="error-title">{{ errorMessage }}</span>
        <KitBtn size="sm" variant="tonal" class="retry-btn" @click="handleGenerateWeather(false)">
          Попробовать снова
        </KitBtn>
      </div>

      <!-- Отображение данных погоды -->
      <div v-else-if="currentCityWeather" class="weather-content">
        <!-- Сводка температур -->
        <div class="weather-summary">
          <div class="summary-item">
            <span class="label">Мин.</span>
            <span class="value">{{ formatTemp(currentCityWeather.tempMin) }}</span>
          </div>
          <div class="summary-item average">
            <span class="label">Средняя</span>
            <span class="value">{{ formatTemp(currentCityWeather.tempAverage) }}</span>
            <span v-if="currentCityWeather.feelsLike !== null && currentCityWeather.feelsLike !== undefined" class="sub-label">
              ощущ. {{ formatTemp(currentCityWeather.feelsLike) }}
            </span>
          </div>
          <div class="summary-item">
            <span class="label">Макс.</span>
            <span class="value">{{ formatTemp(currentCityWeather.tempMax) }}</span>
          </div>
        </div>

        <!-- Единая панель показателей -->
        <div class="climate-grid-panel">
          <!-- Осадки -->
          <div class="climate-cell">
            <div class="cell-header">
              <Icon icon="mdi:weather-rainy" class="cell-icon rain" />
              <span class="cell-title">Осадки</span>
            </div>
            <div class="cell-value">
              {{ currentCityWeather.precipitationProbability !== null && currentCityWeather.precipitationProbability !== undefined ? `${currentCityWeather.precipitationProbability}%` : '—' }}
            </div>
            <div v-if="rainDetailText" class="cell-details" :class="{ 'is-visible': isDetailsExpanded }">
              <span>{{ rainDetailText }}</span>
            </div>
          </div>

          <!-- Ветер -->
          <div class="climate-cell">
            <div class="cell-header">
              <Icon icon="mdi:weather-windy" class="cell-icon wind" />
              <span class="cell-title">Ветер</span>
            </div>
            <div class="cell-value">
              {{ currentCityWeather.windSpeed !== null && currentCityWeather.windSpeed !== undefined ? `${currentCityWeather.windSpeed} км/ч` : '—' }}
            </div>
            <div v-if="currentCityWeather.windDescription" class="cell-details" :class="{ 'is-visible': isDetailsExpanded }">
              <span>{{ currentCityWeather.windDescription }}</span>
            </div>
          </div>

          <!-- Загруженность / Сезон -->
          <div class="climate-cell">
            <div class="cell-header">
              <Icon icon="mdi:account-group-outline" class="cell-icon crowds" />
              <span class="cell-title">Загруженность</span>
            </div>
            <div class="cell-value">
              <span class="season-text" :class="getSeasonalityClass(currentCityWeather.seasonality)">
                {{ getSeasonalityLabel(currentCityWeather.seasonality) }}
              </span>
            </div>
            <div v-if="currentCityWeather.seasonalityDescription" class="cell-details" :class="{ 'is-visible': isDetailsExpanded }">
              <span>{{ currentCityWeather.seasonalityDescription }}</span>
            </div>
          </div>

          <!-- Световой день -->
          <div class="climate-cell">
            <div class="cell-header">
              <Icon icon="mdi:white-balance-sunny" class="cell-icon sun" />
              <span class="cell-title">Световой день</span>
            </div>
            <div class="cell-value">
              {{ currentCityWeather.daylight || 'Обычный' }}
            </div>
            <div class="cell-details" :class="{ 'is-visible': isDetailsExpanded }">
              <span>{{ currentCityWeather.daylightDescription || 'продолжительность дня' }}</span>
            </div>
          </div>
        </div>

        <!-- Кнопка раскрытия подробностей и советов -->
        <button
          v-if="hasDetailedInfo"
          type="button"
          class="details-toggle-btn"
          :class="{ 'is-expanded': isDetailsExpanded }"
          :aria-expanded="isDetailsExpanded"
          @click="isDetailsExpanded = !isDetailsExpanded"
        >
          <span class="toggle-text">
            {{ isDetailsExpanded ? 'Скрыть подробности' : 'Подробности и советы' }}
          </span>
          <Icon icon="mdi:chevron-down" class="toggle-chevron" />
        </button>

        <!-- Сворачиваемая зона: практические рекомендации -->
        <div
          v-if="currentCityWeather.clothingRecommendation || currentCityWeather.summary"
          class="details-collapse"
          :class="{ 'is-open': isDetailsExpanded }"
          :inert="!isDetailsExpanded"
        >
          <div class="details-collapse-inner">
            <div class="recommendations-box">
              <div v-if="currentCityWeather.clothingRecommendation" class="recommendation-item clothing">
                <div class="rec-icon-wrapper">
                  <Icon icon="mdi:tshirt-crew-outline" class="rec-icon" />
                </div>
                <div class="rec-content">
                  <span class="rec-badge">Одежда</span>
                  <p class="rec-text">
                    {{ currentCityWeather.clothingRecommendation }}
                  </p>
                </div>
              </div>

              <div v-if="currentCityWeather.summary" class="recommendation-item tip">
                <div class="rec-icon-wrapper">
                  <Icon icon="mdi:lightbulb-on-outline" class="rec-icon" />
                </div>
                <div class="rec-content">
                  <span class="rec-badge">Совет</span>
                  <p class="rec-text">
                    {{ currentCityWeather.summary }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Состояние пустоты -->
      <div v-else class="empty-state">
        <div class="empty-icon-box">
          <Icon icon="mdi:weather-partly-cloudy" />
        </div>
        <h4 class="empty-title">
          Климатический контекст не сохранен
        </h4>
        <p class="empty-description">
          <template v-if="isEditMode">
            Сгенерируйте сводку погоды, осадков, силы ветра и туристической загруженности для города
            <strong>{{ selectedCity || 'этого маршрута' }}</strong>.
          </template>
          <template v-else>
            Сводка погоды и климатический контекст для города
            <strong>{{ selectedCity || 'этого маршрута' }}</strong> пока не сохранены.
          </template>
        </p>

        <div v-if="isEditMode" class="empty-actions">
          <KitBtn
            variant="tonal"
            color="primary"
            size="sm"
            :loading="isGenerating"
            @click="handleGenerateWeather(false)"
          >
            <Icon icon="mdi:creation" />
            <span>Сгенерировать сводку</span>
          </KitBtn>

          <KitBtn
            v-if="cities.length > 1"
            variant="outlined"
            color="secondary"
            size="sm"
            :loading="isGenerating"
            @click="handleGenerateAllCities(false)"
          >
            <span>Для всех городов ({{ cities.length }})</span>
          </KitBtn>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.weather-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 1rem;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;

  .title-icon {
    font-size: 1.25rem;
    color: var(--fg-accent-color);
  }
}

.widget-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-s);
  background-color: transparent;
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--fg-accent-color);
    border-color: var(--border-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.7);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.city-selector-container {
  margin-bottom: 1rem;
}

.city-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.4);
  border-radius: var(--r-m);
  padding: 8px 12px;
  color: var(--fg-secondary-color);
  width: 100%;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
  font-family: inherit;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.6);
  }
}

.city-selector-text {
  flex-grow: 1;
  text-align: left;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
}

.chevron-icon {
  transition: transform 0.2s ease;
  &.is-open {
    transform: rotate(180deg);
  }
}

.forecast-display {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  padding: 1.15rem 1rem;
  min-height: 220px;
}

.state-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  text-align: center;
  flex-grow: 1;
  padding: 1.5rem 1rem;

  .loading-icon-wrap {
    font-size: 2rem;
    color: var(--fg-accent-color);
    margin-bottom: 4px;
  }

  .loading-title {
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .loading-subtitle {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    max-width: 260px;
  }

  &.error {
    color: var(--fg-error-color);

    .error-icon {
      font-size: 2rem;
    }

    .error-title {
      font-weight: 500;
    }

    .retry-btn {
      margin-top: 8px;
    }
  }
}

.weather-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.weather-summary {
  display: flex;
  justify-content: space-around;
  align-items: center;
  text-align: center;
  width: 100%;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0.5rem;
  gap: 3px;

  .label {
    font-size: 0.725em;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    font-size: 1.35em;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.1;
  }

  .sub-label {
    font-size: 0.725em;
    color: var(--fg-secondary-color);
    margin-top: 2px;
  }

  &.average {
    .value {
      font-size: 2.1em;
      color: var(--fg-accent-color);
    }
    .label {
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }
}

/* Единая панель показателей */
.climate-grid-panel {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  background-color: rgba(var(--bg-secondary-color-rgb), 0.55);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;
}

.climate-cell {
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 2px;

  &:nth-child(odd) {
    border-right: 1px solid var(--border-secondary-color);
  }

  &:nth-child(1),
  &:nth-child(2) {
    border-bottom: 1px solid var(--border-secondary-color);
  }

  .cell-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cell-icon {
    font-size: 1.05rem;
    flex-shrink: 0;

    &.rain {
      color: #3b82f6;
    }
    &.wind {
      color: #06b6d4;
    }
    &.crowds {
      color: #8b5cf6;
    }
    &.sun {
      color: #f59e0b;
    }
  }

  .cell-title {
    font-size: 0.725rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    letter-spacing: 0.2px;
  }

  .cell-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.2;
    margin-top: 2px;
  }

  /* Без ограничения количества строк: текст отображается полностью */
  .cell-details {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition:
      grid-template-rows 0.28s ease,
      opacity 0.2s ease,
      margin-top 0.2s ease;

    span {
      overflow: hidden;
      min-height: 0;
      font-size: 0.725rem;
      color: var(--fg-secondary-color);
      line-height: 1.35;
      display: block;
      word-break: break-word;
    }

    &.is-visible {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 5px;
    }
  }
}

.season-text {
  font-size: 0.85rem;
  font-weight: 600;

  &.seasonality-low {
    color: #10b981;
  }
  &.seasonality-medium {
    color: #3b82f6;
  }
  &.seasonality-high {
    color: #f59e0b;
  }
  &.seasonality-peak {
    color: #ef4444;
  }
}

/* Кнопка с мягким полупрозрачным фоном */
.details-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.35);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.7);
  }

  &.is-expanded {
    border-color: var(--border-primary-color);
    color: var(--fg-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
  }

  .toggle-chevron {
    font-size: 0.95rem;
    transition: transform 0.25s ease;
  }

  &.is-expanded .toggle-chevron {
    transform: rotate(180deg);
  }
}

/* Аккордеон рекомендаций */
.details-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-open {
    grid-template-rows: 1fr;
  }
}

.details-collapse-inner {
  min-height: 0;
  overflow: hidden;
}

.recommendations-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 0.25rem;
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 11px;
  border-radius: var(--r-s);
  background-color: rgba(var(--bg-secondary-color-rgb), 0.55);
  border: 1px solid var(--border-secondary-color);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.75);
  }

  .rec-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--r-s);
    flex-shrink: 0;
  }

  .rec-icon {
    font-size: 0.95em;
  }

  &.clothing {
    .rec-icon-wrapper {
      background-color: rgba(99, 102, 241, 0.12);
      color: #6366f1;
    }
    .rec-badge {
      color: #6366f1;
      background-color: rgba(99, 102, 241, 0.12);
    }
  }

  &.tip {
    .rec-icon-wrapper {
      background-color: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
    }
    .rec-badge {
      color: #f59e0b;
      background-color: rgba(245, 158, 11, 0.12);
    }
  }

  .rec-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .rec-badge {
    align-self: flex-start;
    font-size: 0.65em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .rec-text {
    font-size: 0.775rem;
    color: var(--fg-secondary-color);
    line-height: 1.35;
    margin: 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem;
  gap: 8px;

  .empty-icon-box {
    font-size: 2.25rem;
    color: var(--fg-accent-color);
    opacity: 0.8;
  }

  .empty-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .empty-description {
    font-size: 0.825rem;
    color: var(--fg-secondary-color);
    max-width: 320px;
    margin: 0 0 8px;
    line-height: 1.4;

    strong {
      color: var(--fg-primary-color);
    }
  }

  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

.spin-slow {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@include media-down(sm) {
  .forecast-display {
    padding: 0.75rem;
  }
}
</style>
