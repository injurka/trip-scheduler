<script setup lang="ts">
import type { Component } from 'vue'
import type { TripSection } from '~/shared/types/models/trip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { TripSectionType } from '~/shared/types/models/trip'

const route = useRoute()
const { sections: sectionsStore, ui: uiStore } = useModuleStore(['sections', 'ui'])

const sectionId = computed(() => route.query.section as string)
const section = computed(() => sectionsStore.sections.find(s => s.id === sectionId.value))

const componentsMap: Partial<Record<TripSectionType, Component>> = {
  [TripSectionType.CHECKLIST]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/checklist-section/ui/checklist-section.vue')),
  [TripSectionType.BOOKINGS]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/booking-section/ui/booking-section.vue')),
  [TripSectionType.FINANCES]: defineAsyncComponent(() => import('~/components/04.features/trip-info/trip-sections/finances-section/ui/finances-section.vue')),
}

function handleSectionUpdate(updatedSectionData: TripSection) {
  sectionsStore.updateSection(updatedSectionData)
}
</script>

<template>
  <div v-if="section" class="section-renderer">
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
  <div v-else class="section-not-found">
    Раздел не найден.
  </div>
</template>

<style scoped lang="scss">
.section-content {
  margin-top: 16px;
}
.section-not-found {
  text-align: center;
  padding: 4rem;
  color: var(--fg-secondary-color);
}
</style>
