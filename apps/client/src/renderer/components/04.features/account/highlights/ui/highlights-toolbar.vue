<script setup lang="ts">
import type { HighlightDateRange, HighlightImageQuality } from '../composables/use-highlights'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'

const props = defineProps<{
  quality: HighlightImageQuality
  isOwner: boolean
  selectedCities: string[]
  availableCities: string[]
  dateRange: HighlightDateRange | null
}>()

const emit = defineEmits<{
  (e: 'update:quality', value: HighlightImageQuality): void
  (e: 'update:selectedCities', value: string[]): void
  (e: 'update:dateRange', value: HighlightDateRange | null): void
  (e: 'create'): void
}>()

const localQuality = computed({
  get: () => props.quality,
  set: value => emit('update:quality', value),
})

const localCities = computed({
  get: () => props.selectedCities,
  set: value => emit('update:selectedCities', value),
})

const localDateRange = computed({
  get: () => props.dateRange,
  set: value => emit('update:dateRange', value),
})

const cityOptions = computed<KitDropdownItem<string>[]>(() =>
  props.availableCities.map(c => ({ label: c, value: c })),
)

const dateRangeLabel = computed(() => {
  if (!props.dateRange?.start && !props.dateRange?.end)
    return 'Даты'
  const format = (d: any) => d ? `${d.day.toString().padStart(2, '0')}.${d.month.toString().padStart(2, '0')}.${d.year}` : '...'
  const start = format(props.dateRange?.start)
  const end = format(props.dateRange?.end)
  if (!props.dateRange?.end && props.dateRange?.start)
    return start
  return `${start} - ${end}`
})

const qualityOptions: KitDropdownItem<HighlightImageQuality>[] = [
  { value: 'medium', label: 'Среднее качество', icon: 'mdi:quality-medium' },
  { value: 'large', label: 'Высокое качество', icon: 'mdi:quality-high' },
  { value: 'original', label: 'Оригинал', icon: 'mdi:raw' },
]
</script>

<template>
  <div class="highlights-toolbar">
    <div class="toolbar-filters">
      <div class="filter-item filter-cities">
        <KitSelectWithSearch
          v-model="localCities"
          :items="cityOptions"
          multiple
          clearable
          placeholder="Все города"
          size="sm"
          icon="mdi:map-marker-outline"
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

    <div class="toolbar-actions">
      <KitBtn v-if="isOwner" size="sm" @click="emit('create')">
        <Icon icon="mdi:plus" />
        <span class="desktop-only">Добавить фото</span>
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  flex: 1;
  width: 100%;
}

.filter-cities {
  width: 260px;
  max-width: 100%;
  margin-right: auto;

  :deep(.kit-select-with-search) {
    gap: 0;
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

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-left: 16px;
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
  .toolbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .toolbar-filters {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
