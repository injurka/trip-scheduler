<script setup lang="ts">
import type { Place } from '~/shared/types/models/place'
import { Icon } from '@iconify/vue'
import { KitImage } from '~/components/01.kit/kit-image'

defineProps<{ place: Place }>()
</script>

<template>
  <div class="place-card">
    <div class="card-cover">
      <KitImage :src="place.photoUrl" :alt="place.name" />
    </div>
    <div class="card-content">
      <div v-if="place.rating" class="rating-badge">
        <Icon icon="mdi:star" />
        <span>{{ place.rating.toFixed(1) }}</span>
      </div>
      <h3 class="place-name">
        {{ place.name }}
      </h3>
      <p class="place-description">
        {{ place.description }}
      </p>
      <div v-if="place.tags.length" class="place-tags">
        <span v-for="tag in place.tags" :key="tag.id" class="tag">{{ tag.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.place-card {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  transition: all 0.2s ease-in-out;
  height: 100%;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-l);
    border-color: var(--border-primary-color);
  }
}
.card-cover {
  height: 180px;
  background-color: var(--bg-tertiary-color);
}
.card-content {
  padding: 1rem;
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
.rating-badge {
  position: absolute;
  top: -16px;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 0.25rem 0.75rem;
  border-radius: var(--r-full);
  font-size: 0.9rem;
  font-weight: 600;
}
.place-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0.5rem 0;
}
.place-description {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  margin: 0 0 1rem;
  flex-grow: 1;
}
.place-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: auto;
  .tag {
    font-size: 0.75rem;
    background-color: var(--bg-tertiary-color);
    padding: 0.2rem 0.6rem;
    border-radius: var(--r-s);
  }
}
</style>
