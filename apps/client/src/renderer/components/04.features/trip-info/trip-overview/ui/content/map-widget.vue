<!-- TODO Later -->
<script setup lang="ts">
import { KitMap } from '~/components/01.kit/kit-map'

interface Props {
  city: string
  coordinates: [number, number]
}

defineProps<Props>()
</script>

<template>
  <div class="info-widget-card map-widget">
    <h3 class="widget-title">
      Карта
    </h3>
    <div class="map-container">
      <KitMap :center="coordinates" :zoom="10" height="100%" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.map-widget {
  padding: 0;
  overflow: hidden;
}
.widget-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
  padding: 0.75rem 1rem;
}
.map-container {
  height: 150px;
  width: 100%;
}
</style>
