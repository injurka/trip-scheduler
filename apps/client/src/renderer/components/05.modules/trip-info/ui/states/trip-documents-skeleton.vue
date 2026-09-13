<script setup lang="ts">
import { DocumentsSkeleton } from '~/components/04.features/trip-info/trip-sections/documents-section/ui'

interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false,
})
</script>

<template>
  <div class="trip-documents-skeleton-wrapper">
    <DocumentsSkeleton :readonly="readonly" />
  </div>
</template>

<style scoped lang="scss">
.trip-documents-skeleton-wrapper {
  width: 100%;
  margin-top: 16px;
}
</style>
