<script setup lang="ts">
import type { TimelineStage } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import GalleryBlock from './blocks/gallery-block.vue'
import GeoBlock from './blocks/geo-block.vue'
import TextBlock from './blocks/text-block.vue'

interface IProps {
  stage: TimelineStage
  isLast: boolean
}

defineProps<IProps>()
</script>

<template>
  <div class="timeline-stage" :class="{ 'is-last': isLast }">
    <div class="connector-column">
      <div class="connector-icon">
        <Icon :icon="stage.icon || 'mdi:circle-small'" />
      </div>
      <div v-if="!isLast" class="connector-line" />
    </div>

    <div class="stage-content">
      <header class="stage-header">
        <h4 class="stage-title">
          {{ stage.title }}
        </h4>
        <span v-if="stage.time" class="stage-time">{{ stage.time }}</span>
      </header>

      <div class="blocks-list">
        <template v-for="block in stage.blocks" :key="block.id">
          <TextBlock
            v-if="block.type === 'text'"
            :content="block.content"
          />

          <GalleryBlock
            v-if="block.type === 'gallery'"
            :images="block.images"
            :comment="block.comment"
          />

          <GeoBlock
            v-if="block.type === 'location'"
            type="location"
            :title="block.name"
            :subtitle="block.address"
          />

          <GeoBlock
            v-if="block.type === 'route'"
            type="route"
            :title="`${block.from} ➝ ${block.to}`"
            :subtitle="`${block.distance} • ${block.duration} (${block.transport})`"
            :icon="block.transport === 'walk' ? 'mdi:walk' : 'mdi:car'"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.timeline-stage {
  display: flex;
  gap: 16px;
  position: relative;

  @include media-down(sm) {
    gap: 8px;
  }
}

.connector-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 24px;
}

.connector-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--bg-tertiary-color);
  border: 2px solid var(--bg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);
  font-size: 14px;
  z-index: 2;
  box-shadow: 0 0 0 2px var(--bg-secondary-color);
}

.connector-line {
  flex-grow: 1;
  width: 2px;
  background-color: var(--border-secondary-color);
  margin-top: 4px;
  margin-bottom: 4px;
  border-radius: 2px;
}

.stage-content {
  flex-grow: 1;
  padding-bottom: 32px;

  .is-last & {
    padding-bottom: 0;
  }
}

.stage-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stage-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  margin: 0;
}

.stage-time {
  font-size: 0.85rem;
  font-family: var(--font-mono);
  color: var(--fg-tertiary-color);
  background: var(--bg-tertiary-color);
  padding: 2px 6px;
  border-radius: 4px;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
