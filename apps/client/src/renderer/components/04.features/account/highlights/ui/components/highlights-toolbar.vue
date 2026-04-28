<script setup lang="ts">
import type { HighlightImageQuality, HighlightsDateRange } from '../../composables/use-highlights'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendarRange } from '~/components/01.kit/kit-calendar-range'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'

const props = defineProps<{
  quality: HighlightImageQuality
  filterMode: 'all' | 'trips' | 'dates'
  dateRange: HighlightsDateRange | null
}>()

const emit = defineEmits(['update:quality', 'update:filterMode', 'update:dateRange'])

const isPopoverOpen = ref(false)
const filterSectionRef = ref<HTMLElement | null>(null)

onClickOutside(filterSectionRef, () => {
  isPopoverOpen.value = false
})

const filterLabel = computed(() => {
  if (props.filterMode === 'all')
    return 'Всё подряд'
  if (props.filterMode === 'trips')
    return 'По путешествиям'
  if (props.filterMode === 'dates')
    return 'По датам'
  return 'Всё подряд'
})

const filterItems = [
  { id: 'all', label: 'Всё' },
  { id: 'trips', label: 'Поездки' },
  { id: 'dates', label: 'Даты' },
]

const qualityOptions: KitDropdownItem<HighlightImageQuality>[] = [
  { value: 'medium', label: 'Среднее', icon: 'mdi:quality-medium' },
  { value: 'large', label: 'Высокое', icon: 'mdi:quality-high' },
  { value: 'original', label: 'Оригинал', icon: 'mdi:raw' },
]

const qualityIcon = computed(() => qualityOptions.find(q => q.value === props.quality)?.icon || 'mdi:image-outline')

const localQuality = computed({
  get: () => props.quality,
  set: val => emit('update:quality', val),
})

const localFilterMode = computed({
  get: () => props.filterMode,
  set: val => emit('update:filterMode', val),
})

const localDateRange = computed({
  get: () => props.dateRange,
  set: val => emit('update:dateRange', val),
})
</script>

<template>
  <div class="highlights-toolbar">
    <div class="toolbar-content">
      <!-- Слева: Фильтры -->
      <div ref="filterSectionRef" class="filter-section">
        <KitBtn
          variant="subtle"
          color="secondary"
          size="sm"
          class="filter-toggle"
          @click="isPopoverOpen = !isPopoverOpen"
        >
          Показывать: <strong>{{ filterLabel }}</strong>
          <Icon :icon="isPopoverOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </KitBtn>

        <Transition name="popover-fade">
          <div v-if="isPopoverOpen" class="popover">
            <KitViewSwitcher
              v-model="localFilterMode"
              :items="filterItems"
              full-width
            />

            <div v-if="filterMode === 'dates'" class="date-inputs">
              <KitCalendarRange v-model="localDateRange" />
            </div>
          </div>
        </Transition>
      </div>

      <!-- Справа: Качество -->
      <div class="quality-section">
        <KitDropdown
          v-model="localQuality"
          :items="qualityOptions"
          align="end"
        >
          <template #trigger>
            <KitBtn
              variant="subtle"
              color="secondary"
              size="sm"
              :icon="qualityIcon"
              title="Выбрать качество"
            />
          </template>
        </KitDropdown>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-toolbar {
  margin-bottom: 12px;
  padding: 12px 16px;
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-section {
  position: relative;
}

.filter-toggle {
  strong {
    font-weight: 600;
  }
}

.popover {
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px;
  box-shadow: var(--s-xl);
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 20;
}

.date-inputs {
  display: flex;
  justify-content: center;
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

@include media-down(sm) {
  .toolbar-content {
    flex-direction: row;
    align-items: center;
  }
  .popover {
    min-width: calc(100vw - 32px);
  }
}
</style>
