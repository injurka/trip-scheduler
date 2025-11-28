<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

interface Props {
  cities: string[]
  startDate: string
}

interface WeatherData {
  average: number | null
  min: number | null
  max: number | null
  rainyDays: number | null
  windSpeed: number | null
}

const props = defineProps<Props>()

const selectedCity = ref<string | null>(null)
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

function processDailyData(daily: any): Partial<WeatherData> {
  const temperatures = daily.temperature_2m_mean || []
  const tempMin = daily.temperature_2m_min || temperatures
  const tempMax = daily.temperature_2m_max || temperatures

  const precipitations = daily.precipitation_sum || []
  const windSpeeds = (daily.windspeed_10m_mean || daily.wind_speed_10m_mean || []).filter((w: number | null) => w !== null) as number[]

  const result: Partial<WeatherData> = {}

  result.average = getAverage(temperatures)
  result.min = getAverage(tempMin)
  result.max = getAverage(tempMax)

  const rainyDaysThreshold = 1.0
  result.rainyDays = precipitations.filter((p: number | null) => p !== null && p > rainyDaysThreshold).length

  if (windSpeeds.length > 0)
    result.windSpeed = Math.round(windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length)

  return result
}

async function fetchWeatherForCity(city: string) {
  if (!city || !props.startDate)
    return

  isLoading.value = true
  error.value = null
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
      dailyParams = 'temperature_2m_mean,precipitation_sum,wind_speed_10m_mean'
    }
    else {
      apiUrl = 'https://archive-api.open-meteo.com/v1/archive'
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
            <span class="value">{{ weatherData.min }}°</span>
          </div>
          <div class="summary-item average">
            <span class="label">Средняя</span>
            <span class="value">{{ weatherData.average }}°</span>
          </div>
          <div class="summary-item">
            <span class="label">Макс.</span>
            <span class="value">{{ weatherData.max }}°</span>
          </div>
        </div>
        <div class="weather-details">
          <div v-if="weatherData.rainyDays !== null" class="detail-item">
            <div class="icon-box">
              <Icon icon="mdi:weather-rainy" />
            </div>
            <div class="detail-text">
              <span class="detail-value">{{ weatherData.rainyDays }} дн.</span>
              <span class="detail-label">осадки</span>
            </div>
          </div>
          <div v-if="weatherData.windSpeed !== null" class="detail-item">
            <div class="icon-box">
              <Icon icon="mdi:weather-windy" />
            </div>
            <div class="detail-text">
              <span class="detail-value">{{ weatherData.windSpeed }} км/ч</span>
              <span class="detail-label">ветер</span>
            </div>
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
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  padding: 1.25rem 1rem;
  min-height: 190px;
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
  padding: 1rem;

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
  padding: 0 0.5rem;
  gap: 4px;

  .label {
    font-size: 0.8rem;
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

.weather-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-secondary-color);
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  .icon-box {
    color: var(--fg-tertiary-color);
    font-size: 1.4rem;
    display: flex;
    align-items: center;
  }

  .detail-text {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .detail-value {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.1;
  }

  .detail-label {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
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
  .forecast-display {
    padding: 1rem;
  }

  .weather-content {
    gap: 1rem;
  }

  .weather-summary {
    flex-direction: row;
    justify-content: space-between;
    padding: 0 0.5rem;
  }

  .summary-item {
    .label {
      font-size: 0.7rem;
    }
    .value {
      font-size: 1.2rem;
    }

    &.average {
      .value {
        font-size: 1.8rem;
      }
    }
  }

  .weather-details {
    gap: 0.75rem;
    padding-top: 1rem;
  }

  .detail-item {
    gap: 8px;

    .icon-box {
      font-size: 1.2rem;
    }

    .detail-value {
      font-size: 0.9rem;
    }
  }
}
</style>
