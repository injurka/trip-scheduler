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

        <span
          v-if="currentCityWeather"
          class="saved-badge"
          title="Контекст сохранен в базу данных путешествия"
        >
          <Icon icon="mdi:check-circle-outline" />
          <span class="badge-text">В поездке</span>
        </span>
      </div>
    </div>

    <!-- Селектор городов (если больше одного) -->
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

      <!-- Отображение данных погоды и контекста -->
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

        <!-- Сетка ключевых климатических показателей -->
        <div class="weather-details-grid">
          <!-- Осадки -->
          <div class="detail-card">
            <div class="icon-box rain">
              <Icon icon="mdi:weather-rainy" />
            </div>
            <div class="detail-text">
              <span class="detail-value">
                {{ currentCityWeather.precipitationProbability !== null && currentCityWeather.precipitationProbability !== undefined ? `${currentCityWeather.precipitationProbability}%` : 'Осадки' }}
              </span>
              <span class="detail-label" :title="currentCityWeather.precipitationType || ''">
                {{ currentCityWeather.rainyDays ? `${currentCityWeather.rainyDays} дн. с осадками` : (currentCityWeather.precipitationType || 'осадки') }}
              </span>
            </div>
          </div>

          <!-- Ветер -->
          <div class="detail-card">
            <div class="icon-box wind">
              <Icon icon="mdi:weather-windy" />
            </div>
            <div class="detail-text">
              <span class="detail-value">
                {{ currentCityWeather.windSpeed !== null && currentCityWeather.windSpeed !== undefined ? `${currentCityWeather.windSpeed} км/ч` : 'Ветер' }}
              </span>
              <span class="detail-label" :title="currentCityWeather.windDescription || ''">
                {{ currentCityWeather.windDescription || 'ветер' }}
              </span>
            </div>
          </div>

          <!-- Загруженность / Сезон -->
          <div class="detail-card">
            <div class="icon-box crowds">
              <Icon icon="mdi:account-group-outline" />
            </div>
            <div class="detail-text">
              <div class="season-badge" :class="getSeasonalityClass(currentCityWeather.seasonality)">
                {{ getSeasonalityLabel(currentCityWeather.seasonality) }}
              </div>
              <span class="detail-label" :title="currentCityWeather.seasonalityDescription || ''">
                {{ currentCityWeather.seasonalityDescription || 'загруженность' }}
              </span>
            </div>
          </div>

          <!-- Световой день -->
          <div class="detail-card">
            <div class="icon-box sun">
              <Icon icon="mdi:white-balance-sunny" />
            </div>
            <div class="detail-text">
              <span class="detail-value">
                {{ currentCityWeather.daylight || 'Обычный' }}
              </span>
              <span class="detail-label">световой день</span>
            </div>
          </div>
        </div>

        <!-- Практические рекомендации (одежда и советы) -->
        <div v-if="currentCityWeather.clothingRecommendation || currentCityWeather.summary" class="recommendations-box">
          <div v-if="currentCityWeather.clothingRecommendation" class="recommendation-item">
            <Icon icon="mdi:tshirt-crew-outline" class="rec-icon" />
            <div class="rec-body">
              <span class="rec-title">Одежда:</span>
              <span class="rec-text">{{ currentCityWeather.clothingRecommendation }}</span>
            </div>
          </div>

          <div v-if="currentCityWeather.summary" class="recommendation-item">
            <Icon icon="mdi:lightbulb-on-outline" class="rec-icon tip" />
            <div class="rec-body">
              <span class="rec-title">Совет:</span>
              <span class="rec-text">{{ currentCityWeather.summary }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Состояние пустоты: данные еще не сгенерированы -->
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
@use '~/assets/scss/_setup.scss' as *;

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
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--fg-accent-color);
    border-color: var(--border-primary-color);
    background: var(--bg-secondary-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.saved-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--r-s);
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 0.725rem;
  font-weight: 500;
}

.city-selector-container {
  margin-bottom: 1rem;
}

.city-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  padding: 8px 12px;
  color: var(--fg-secondary-color);
  width: 100%;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: border-color 0.2s ease;
  font-family: inherit;

  &:hover {
    border-color: var(--border-primary-color);
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
  padding: 1.25rem 1rem;
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
  gap: 1.25rem;
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
  gap: 4px;

  .label {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.1;
  }

  .sub-label {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
    margin-top: 2px;
  }

  &.average {
    .value {
      font-size: 2.2rem;
      color: var(--fg-accent-color);
    }
    .label {
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }
}

.weather-details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);
}

.detail-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-secondary-color);
  padding: 8px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;

  .icon-box {
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
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

  .detail-text {
    display: flex;
    flex-direction: column;
    text-align: left;
    overflow: hidden;
  }

  .detail-value {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-label {
    font-size: 0.725rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.season-badge {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;

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

.recommendations-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-secondary-color);
}

.recommendation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.825rem;
  line-height: 1.4;

  .rec-icon {
    font-size: 1rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    margin-top: 2px;

    &.tip {
      color: #f59e0b;
    }
  }

  .rec-body {
    display: flex;
    gap: 4px;
  }

  .rec-title {
    font-weight: 600;
    color: var(--fg-primary-color);
    flex-shrink: 0;
  }

  .rec-text {
    color: var(--fg-secondary-color);
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
    padding: 1rem;
  }

  .weather-details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
