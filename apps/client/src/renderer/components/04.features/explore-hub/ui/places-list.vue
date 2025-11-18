<script setup lang="ts">
import type { Place } from '~/shared/types/models/place'
import PlaceCard from './place-card.vue'

defineProps<{ places: Place[] }>()
</script>

<template>
  <div class="places-list-grid">
    <PlaceCard v-for="place in places" :key="place.id" :place="place" />
  </div>
</template>

<style scoped lang="scss">
.places-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}
</style>
