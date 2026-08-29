<script setup lang="ts">
import type { Component } from 'vue'
import type { IDay } from '~/components/04.features/trip-info/trip-plan/models/types'
import type { TripSection } from '~/shared/types/models/trip'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { lazyComponent } from '~/shared/lib/lazy-component'
import { TripSectionType } from '~/shared/types/models/trip'

const props = defineProps<{
  sectionId: string
  days: IDay[]
}>()

const { sections: sectionsStore, ui: uiStore } = useModuleStore(['sections', 'ui'])

const section = computed(() => sectionsStore.sections.find(s => s.id === props.sectionId))

const TripMapSection = lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/map-section/ui/trip-map-section.vue'), { showLoader: true })

const componentsMap: Partial<Record<TripSectionType, Component>> = {
  [TripSectionType.CHECKLIST]: lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/checklist-section/ui/checklist-section.vue'), { showLoader: true }),
  [TripSectionType.BOOKINGS]: lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/booking-section/ui/booking-section.vue'), { showLoader: true }),
  [TripSectionType.FINANCES]: lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/finances-section/ui/finances-section.vue'), { showLoader: true }),
  [TripSectionType.DOCUMENTS]: lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/documents-section/ui/documents-section.vue'), { showLoader: true }),
  [TripSectionType.MEMORIES]: lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/memories-section/ui/memories-section.vue'), { showLoader: true }),
  [TripSectionType.NOTES]: lazyComponent(() => import('~/components/04.features/trip-info/trip-sections/notes-section/ui/notes-section.vue'), { showLoader: true }),
}

function handleSectionUpdate(updatedSectionData: TripSection) {
  sectionsStore.updateSection(updatedSectionData)
}
</script>

<template>
  <TripMapSection
    v-if="sectionId === 'map'"
    :days="days"
    class="full-height-section"
  />

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
  position: relative;
}
.section-not-found {
  text-align: center;
  padding: 4rem;
  color: var(--fg-secondary-color);
}
</style>
