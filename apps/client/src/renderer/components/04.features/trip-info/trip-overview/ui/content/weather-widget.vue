<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

interface Props {
  cities: string[]
  startDate: string
}

// Убрали solarIndex
interface WeatherData {
  average: number | null
  min: number | null
  max: number | null
  rainyDays: number | null
  windSpeed: number | null
}

const props = defineProps<Props>()

const selectedCity = ref<string | null>(null)
// Убрали solarIndex
const weatherData = ref<WeatherData>({
  average: null,
  min: null,
  max: null,
  rainyDays: null,
  windSpeed: null,
})
const isLoading = ref(false)
const error = ref<string | null>(null)
const isDropdownOpen = ref(false)

const cityOptions = computed(() => {
  return props.cities.map(city => ({
    value: city,
    label: city,
  }))
})

const monthName = computed(() => {
  if (!props.startDate)
    return ''
  const date = new Date(props.startDate)
  return date.toLocaleString('ru-RU', { month: 'long' })
})

function getAverage(arr: (number | null)[]): number | null {
  const validNumbers = arr.filter(n => n !== null) as number[]
  if (validNumbers.length === 0)
    return null
  const sum = validNumbers.reduce((a, b) => a + b, 0)
  return Math.round(sum / validNumbers.length)
}

// Убрали функцию getSolarIndex

function processDailyData(daily: any): Partial<WeatherData> {
  const temperatures = daily.temperature_2m_mean || []
  const tempMin = daily.temperature_2m_min || temperatures
  const tempMax = daily.temperature_2m_max || temperatures

  const precipitations = daily.precipitation_sum || []
  const windSpeeds = (daily.windspeed_10m_mean || daily.wind_speed_10m_mean || []).filter((w: number | null) => w !== null) as number[]
  // Убрали solarRadiations

  const result: Partial<WeatherData> = {}

  result.average = getAverage(temperatures)
  result.min = getAverage(tempMin)
  result.max = getAverage(tempMax)

  const rainyDaysThreshold = 1.0
  result.rainyDays = precipitations.filter((p: number | null) => p !== null && p > rainyDaysThreshold).length

  if (windSpeeds.length > 0)
    result.windSpeed = Math.round(windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length)

  // Убрали логику расчета solarIndex

  return result
}

async function fetchWeatherForCity(city: string) {
  if (!city || !props.startDate)
    return

  isLoading.value = true
  error.value = null
  // Убрали solarIndex
  weatherData.value = { average: null, min: null, max: null, rainyDays: null, windSpeed: null }

  try {
    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`)
    if (!geoResponse.ok)
      throw new Error('Не удалось получить координаты города.')
    const geoData = await geoResponse.json()
    if (!geoData.results || geoData.results.length === 0)
      throw new Error(`Город '${city}' не найден.`)
    const { latitude, longitude } = geoData.results[0]

    const tripDate = new Date(props.startDate)
    const year = tripDate.getFullYear()
    const month = tripDate.getMonth()
    const startDateOfMonth = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0]
    const endDateOfMonth = new Date(Date.UTC(year, month + 1, 0)).toISOString().split('T')[0]

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)
    const isFutureTrip = tripDate > currentDate

    let apiUrl: string
    let dailyParams: string

    if (isFutureTrip) {
      apiUrl = 'https://climate-api.open-meteo.com/v1/climate'
      // Убрали shortwave_radiation_sum из запроса
      dailyParams = 'temperature_2m_mean,precipitation_sum,wind_speed_10m_mean'
    }
    else {
      apiUrl = 'https://archive-api.open-meteo.com/v1/archive'
      // Убрали shortwave_radiation_sum из запроса
      dailyParams = 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_mean'
    }

    const weatherResponse = await fetch(`${apiUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${startDateOfMonth}&end_date=${endDateOfMonth}&daily=${dailyParams}&timezone=auto`)
    if (!weatherResponse.ok)
      throw new Error(`Не удалось загрузить ${isFutureTrip ? 'климатический прогноз' : 'архив погоды'}.`)

    const weatherApiData = await weatherResponse.json()

    if (weatherApiData.daily) {
      const processed = processDailyData(weatherApiData.daily)
      weatherData.value = { ...weatherData.value, ...processed }
    }
    else {
      throw new Error('Данные о погоде отсутствуют в ответе API.')
    }
  }
  catch (e: any) {
    console.error('Weather widget error:', e)
    error.value = e.message || 'Произошла ошибка при запросе погоды.'
  }
  finally {
    isLoading.value = false
  }
}

watch(selectedCity, (newCity) => {
  if (newCity) {
    fetchWeatherForCity(newCity)
  }
})

onMounted(() => {
  if (props.cities.length > 0) {
    selectedCity.value = props.cities[0]
  }
})
</script>

<template>
  <div class="info-widget-card weather-widget">
    <h3 class="widget-title">
      Средняя погода в {{ monthName }}
    </h3>
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
      <div v-if="isLoading" class="state-info">
        <Icon icon="mdi:loading" class="spin" />
        <span>Загрузка прогноза...</span>
      </div>
      <div v-else-if="error" class="state-info error">
        <Icon icon="mdi:alert-circle-outline" />
        <span>{{ error }}</span>
      </div>
      <div v-else-if="weatherData.average !== null" class="weather-content">
        <div class="weather-summary">
          <div class="summary-item">
            <span class="label">Мин.</span>
            <span class="value">{{ weatherData.min }}°C</span>
          </div>
          <div class="summary-item average">
            <span class="label">Сред.</span>
            <span class="value">{{ weatherData.average }}°C</span>
          </div>
          <div class="summary-item">
            <span class="label">Макс.</span>
            <span class="value">{{ weatherData.max }}°C</span>
          </div>
        </div>
        <div class="weather-details">
          <!-- УДАЛЕНО: Блок с солнечной активностью -->
          <div v-if="weatherData.rainyDays !== null" class="detail-item">
            <Icon icon="mdi:weather-rainy" />
            <span class="detail-value">{{ weatherData.rainyDays }} дн.</span>
            <span class="detail-label">в месяц</span>
          </div>
          <div v-if="weatherData.windSpeed !== null" class="detail-item">
            <Icon icon="mdi:weather-windy" />
            <span class="detail-value">{{ weatherData.windSpeed }} км/ч</span>
            <span class="detail-label">сред.</span>
          </div>
        </div>
      </div>
      <div v-else class="state-info">
        <span>Нет данных для отображения</span>
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
.widget-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0 0 1rem;
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
  min-height: 100px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  padding: 1rem;
  min-height: 230px;
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

  &.error {
    color: var(--fg-error-color);
  }
  .spin {
    animation: spin 1s linear infinite;
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
  padding: 0 1rem;
  gap: 10px;

  .label {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    margin-bottom: 0.25rem;
  }
  .value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  &.average {
    .value {
      font-size: 2.5rem;
      line-height: 32px;
      color: var(--fg-accent-color);
    }
    .label {
      font-size: 1rem;
    }
  }
}

.weather-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-secondary-color);
}

.detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;

  .iconify {
    font-size: 1.5rem;
    margin-bottom: 4px;
    color: var(--fg-tertiary-color);
  }

  .detail-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
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
  .weather-summary {
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
  }
  .summary-item.average .value {
    font-size: 2.25rem;
  }
  .weather-details {
    gap: 0.5rem;
  }
  .detail-item {
    .iconify {
      font-size: 1.25rem;
    }
    .detail-value {
      font-size: 0.9rem;
    }
  }
}
</style>
