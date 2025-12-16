<script setup lang="ts">
import type { Component } from 'vue'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import type { TripSection } from '~/shared/types/models/trip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { TripSectionType } from '~/shared/types/models/trip'

const props = defineProps<{
  sectionId: string
  days: IDay[] // Добавляем days, так как карта требует их
}>()

const { sections: sectionsStore, ui: uiStore } = useModuleStore(['sections', 'ui'])

// Если ID === 'map', секции в сторе не будет, это нормально
const section = computed(() => sectionsStore.sections.find(s => s.id === props.sectionId))

// Динамический импорт карты, чтобы не грузить её, если не нужна
const TripMapSection = defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/map-section/ui/trip-map-section.vue'))

const componentsMap: Partial<Record<TripSectionType, Component>> = {
  [TripSectionType.CHECKLIST]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/checklist-section/ui/checklist-section.vue')),
  [TripSectionType.BOOKINGS]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/booking-section/ui/booking-section.vue')),
  [TripSectionType.FINANCES]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/finances-section/ui/finances-section.vue')),
  [TripSectionType.DOCUMENTS]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/documents-section/ui/documents-section.vue')),
}

function handleSectionUpdate(updatedSectionData: TripSection) {
  sectionsStore.updateSection(updatedSectionData)
}
</script>

<template>
  <!-- 1. Специальный случай для Карты -->
  <TripMapSection
    v-if="sectionId === 'map'"
    :days="days"
    class="full-height-section"
  />

  <!-- 2. Обычные секции -->
  <div v-else-if="section" class="section-renderer">
    <div class="section-content">
      <component
        :is="componentsMap[section.type]"
        v-if="componentsMap[section.type]"
        :section="section"
        :readonly="uiStore.isViewMode"
        @update-section="handleSectionUpdate"
      />
      <div v-else class="unknown-section">
        Тип раздела "{{ section.type }}" находится в разработке.
      </div>
    </div>
  </div>

  <!-- 3. Ошибка (ни карта, ни секция не найдены) -->
  <div v-else class="section-not-found">
    Раздел не найден.
  </div>
</template>

<style scoped lang="scss">
.full-height-section {
  height: 100%;
  width: 100%;
  flex: 1;
}
.section-content {
  margin-top: 16px;
  position: relative;
  z-index: 3;
}
.section-not-found {
  text-align: center;
  padding: 4rem;
  color: var(--fg-secondary-color);
}
</style>
