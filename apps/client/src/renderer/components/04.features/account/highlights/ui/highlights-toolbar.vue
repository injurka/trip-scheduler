<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { HighlightDateRange, HighlightImageQuality } from '../composables/use-highlights'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { GeoPlaceRef } from '~/shared/types/models/geo-place'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { GeoPlacePicker } from '~/components/03.domain/geo-place-picker'

const props = defineProps<{
  quality: HighlightImageQuality
  selectedPlaces: GeoPlaceRef[]
  legacySelectedCities: string[]
  dateRange: HighlightDateRange | null
}>()

const emit = defineEmits<{
  (e: 'update:quality', value: HighlightImageQuality): void
  (e: 'update:selectedPlaces', value: GeoPlaceRef[]): void
  (e: 'update:dateRange', value: HighlightDateRange | null): void
  (e: 'clearLegacyCities'): void
}>()

const localQuality = computed({
  get: () => props.quality,
  set: value => emit('update:quality', value),
})

const localPlaces = computed({
  get: () => props.selectedPlaces,
  set: (value: GeoPlaceRef | GeoPlaceRef[] | null) => emit('update:selectedPlaces', Array.isArray(value) ? value : value ? [value] : []),
})

const localDateRange = computed({
  get: () => props.dateRange,
  set: value => emit('update:dateRange', value),
})

const dateRangeLabel = computed(() => {
  if (!props.dateRange?.start && !props.dateRange?.end)
    return 'Даты'

  const format = (d: CalendarDate | null | undefined) =>
    d ? `${d.day.toString().padStart(2, '0')}.${d.month.toString().padStart(2, '0')}.${d.year}` : '...'

  const start = format(props.dateRange?.start)
  const end = format(props.dateRange?.end)

  if (!props.dateRange?.end && props.dateRange?.start)
    return start

  return `${start} - ${end}`
})

const qualityOptions: KitDropdownItem<HighlightImageQuality>[] = [
  { value: 'medium', label: 'Среднее', icon: 'mdi:quality-medium' },
  { value: 'large', label: 'Высокое', icon: 'mdi:quality-high' },
  { value: 'original', label: 'Оригинал', icon: 'mdi:raw' },
]
</script>

<template>
  <div class="highlights-toolbar">
    <div class="toolbar-filters">
      <div class="filter-item filter-cities">
        <GeoPlacePicker
          v-model="localPlaces"
          multiple
          placeholder="Все города"
        />
      </div>

      <div class="filter-item filter-date">
        <KitDropdown :side-offset="8" align="start">
          <template #trigger>
            <KitBtn
              variant="outlined"
              color="secondary"
              size="sm"
              icon="mdi:calendar-month-outline"
              class="date-btn"
            >
              <span class="desktop-only">{{ dateRangeLabel }}</span>
            </KitBtn>
          </template>
          <div class="calendar-dropdown-content">
            <KitCalendarRange v-model="localDateRange" />
            <div v-if="localDateRange?.start || localDateRange?.end" class="calendar-actions">
              <KitBtn size="sm" variant="subtle" @click="localDateRange = null">
                Сбросить
              </KitBtn>
            </div>
          </div>
        </KitDropdown>
      </div>

      <div class="filter-item filter-quality">
        <KitDropdown v-model="localQuality" :items="qualityOptions" align="start">
          <template #trigger>
            <KitBtn
              variant="outlined"
              color="secondary"
              size="sm"
              icon="mdi:image-size-select-actual"
            >
              <span class="desktop-only">Качество</span>
            </KitBtn>
          </template>
        </KitDropdown>
      </div>
    </div>
    <div v-if="legacySelectedCities.length > 0" class="legacy-city-filter">
      Старый фильтр по названию: {{ legacySelectedCities.join(', ') }}
      <button type="button" @click="emit('clearLegacyCities')">
        Сбросить
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.filter-cities {
  width: 260px;
  max-width: 100%;
  margin-right: auto;

  :deep(.geo-place-picker__control) {
    min-height: 38px;
  }
}

.legacy-city-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 0;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;

  button {
    border: 0;
    padding: 0;
    color: var(--primary-color);
    background: transparent;
    cursor: pointer;
  }
}

.filter-date {
  .date-btn {
    min-width: 46px;
  }
}

.calendar-dropdown-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-actions {
  display: flex;
  justify-content: flex-end;
}

.desktop-only {
  @include media-down(sm) {
    display: none;
  }
}

@include media-down(sm) {
  .highlights-toolbar {
    gap: 8px;
  }
  .toolbar-filters {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
