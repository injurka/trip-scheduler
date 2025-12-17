<script setup lang="ts">
import type { PostMedia } from '../../../models/types'
import { KitImage } from '~/components/01.kit/kit-image'

defineProps<{ images: PostMedia[], comment?: string }>()
</script>

<template>
  <div class="gallery-block">
    <div class="grid" :class="`count-${Math.min(images.length, 4)}`">
      <div v-for="(img, idx) in images.slice(0, 4)" :key="idx" class="img-wrapper">
        <KitImage :src="img.url" object-fit="cover" />
        <div v-if="images.length > 4 && idx === 3" class="more-overlay">
          +{{ images.length - 4 }}
        </div>
      </div>
    </div>
    <p v-if="comment" class="comment">
      {{ comment }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.gallery-block {
  margin: 12px 0;
}
.grid {
  display: grid;
  gap: 8px;
  height: 240px;
  border-radius: var(--r-m);
  overflow: hidden;

  &.count-1 {
    grid-template-columns: 1fr;
  }
  &.count-2 {
    grid-template-columns: 1fr 1fr;
  }
  &.count-3 {
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 1fr 1fr;
    .img-wrapper:first-child {
      grid-row: span 2;
    }
  }
  &.count-4 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
}

.img-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.2rem;
}

.comment {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  font-style: italic;
  margin-top: 8px;
}
</style>
