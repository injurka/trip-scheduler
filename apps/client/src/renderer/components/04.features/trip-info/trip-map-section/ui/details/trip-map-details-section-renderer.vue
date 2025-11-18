<script setup lang="ts">
import type { ActivitySection, ActivitySectionGallery, ActivitySectionText } from '~/shared/types/models/activity'
import { EActivitySectionType } from '~/shared/types/models/activity'
import DescriptionSection from './trip-map-details-description-section.vue'
import GallerySection from './trip-map-details-gallery-section.vue'

interface Props {
  section: ActivitySection
}

defineProps<Props>()
</script>

<template>
  <div class="activity-section-renderer">
    <DescriptionSection
      v-if="section.type === EActivitySectionType.DESCRIPTION"
      :section="section as ActivitySectionText"
    />
    <GallerySection
      v-else-if="section.type === EActivitySectionType.GALLERY"
      :section="section as ActivitySectionGallery"
    />
  </div>
</template>

<style scoped lang="scss">
.activity-section-renderer {
  position: relative;
}
</style>
