<script setup lang="ts">
import type { GroupedMemory } from '../composables/use-memories-view'
import { Icon } from '@iconify/vue'
import { KitImage } from '~/components/01.kit/kit-image'

defineProps<{
  group: GroupedMemory
}>()

const emit = defineEmits<{
  (e: 'clickImage', id: string): void
}>()
</script>

<template>
  <div class="gallery-group">
    <div class="group-header">
      <span class="group-title">{{ group.title }}</span>
      <span class="group-count">{{ group.items.length }}</span>
      <div class="group-line" />
    </div>

    <div class="photos-grid">
      <div
        v-for="item in group.items"
        :key="item.id"
        class="photo-card"
        @click="emit('clickImage', item.id)"
      >
        <KitImage
          :src="item.image?.variants?.medium || item.image?.url"
          object-fit="cover"
          class="photo-img"
        />
        <div class="photo-overlay">
          <span v-if="item.comment" class="overlay-icon" title="Есть комментарий">
            <Icon icon="mdi:comment-text-outline" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gallery-group {
  display: flex;
  flex-direction: column;
  gap: 12px;

  content-visibility: auto;
  contain-intrinsic-size: 1px 250px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
  margin-top: 16px;

  .group-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    text-transform: capitalize;
  }

  .group-count {
    font-size: 0.85rem;
    color: var(--fg-tertiary-color);
    font-weight: 500;
  }

  .group-line {
    flex-grow: 1;
    height: 1px;
    background-color: var(--border-secondary-color);
    margin-left: 8px;
  }
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  grid-auto-rows: 180px;
  grid-auto-flow: dense;
}

.photo-card {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  background-color: var(--bg-tertiary-color);
  transition: transform 0.2s;

  &:nth-child(5n) {
    grid-column: span 2;
    grid-row: span 2;
  }

  &:hover {
    transform: scale(0.98);
    .photo-overlay {
      opacity: 1;
    }
  }
}

.photo-img {
  width: 100%;
  height: 100%;
  display: block;
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 40%);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 8px;
}

.overlay-icon {
  color: white;
  font-size: 1.1rem;
}

@media (max-width: 600px) {
  .photos-grid {
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 140px;

    .photo-card:nth-child(n) {
      grid-column: auto;
      grid-row: auto;
    }
  }
}
</style>
