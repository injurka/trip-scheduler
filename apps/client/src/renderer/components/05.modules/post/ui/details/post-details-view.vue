<script setup lang="ts">
import type { PostDetail } from '../../models/types'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { TripComments } from '~/components/04.features/trip-info/trip-comments'
import { CommentParentType } from '~/shared/types/models/comment'

import PostHero from './post-hero.vue'
import PostMapView from './post-map-view.vue'
import TimelineStage from './timeline-stage.vue'

const props = defineProps<{ post: PostDetail }>()

// --- Navigation Scroll Logic ---
const activeStageId = ref(props.post.stages[0]?.id)
const isMapVisible = ref(false)

function scrollToStage(id: string) {
  activeStageId.value = id
  const el = document.getElementById(`stage-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>

<template>
  <div class="post-details-page">
    <div class="nav-overlay">
      <NavigationBack />
    </div>

    <PostHero :post="post" />

    <div class="content-container">
      <!-- Sticky Navigation Tabs -->
      <div v-if="post.stages.length > 0" class="sticky-nav">
        <div class="nav-scroller">
          <button
            v-for="stage in post.stages"
            :key="stage.id"
            class="nav-tab"
            :class="{ active: activeStageId === stage.id }"
            @click="scrollToStage(stage.id)"
          >
            {{ stage.title }}
          </button>
        </div>
      </div>

      <!-- Timeline -->
      <div class="timeline-container">
        <div
          v-for="(stage, index) in post.stages"
          :id="`stage-${stage.id}`"
          :key="stage.id"
          class="stage-wrapper"
        >
          <TimelineStage
            :stage="stage"
            :is-last="index === post.stages.length - 1"
          />
        </div>

        <div v-if="post.stages.length === 0" class="empty-state">
          <p>Автор еще не добавил этапы в этот маршрут.</p>
        </div>
      </div>

      <KitDivider class="comments-divider">
        Обсуждение
      </KitDivider>

      <!-- Comments Section -->
      <section class="comments-section">
        <TripComments
          :parent-id="post.id"
          :parent-type="CommentParentType.POST"
        />
      </section>
    </div>

    <!-- Floating Map Button -->
    <button class="map-fab" title="Показать на карте" @click="isMapVisible = true">
      <Icon icon="mdi:map" />
      <span class="fab-text">Карта</span>
    </button>

    <!-- Map Modal -->
    <PostMapView
      v-model:visible="isMapVisible"
      :post="post"
    />
  </div>
</template>

<style scoped lang="scss">
.post-details-page {
  position: relative;
  background-color: var(--bg-primary-color);
  min-height: 100vh;
  padding-bottom: 24px;
}

.nav-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
}

.content-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px;
}

.sticky-nav {
  position: sticky;
  top: 10px;
  z-index: 5;
  background: rgba(var(--bg-primary-color-rgb), 0.8);
  backdrop-filter: blur(10px);
  padding: 8px 0;
  margin-bottom: 24px;
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-m);
}

.nav-scroller {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding: 0 8px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nav-tab {
  padding: 6px 12px;
  border-radius: var(--r-full);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  border: 1px solid transparent;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-primary-color);
  }

  &.active {
    background: var(--fg-accent-color);
    color: white;
  }
}

.timeline-container {
  margin-top: 16px;
  min-height: calc(100vh - 500px);
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--fg-secondary-color);
  font-style: italic;
}

/* Comments */
.comments-divider {
  margin: 40px 0 24px;
}

.comments-section {
  background: var(--bg-secondary-color);
  border-radius: var(--r-l);
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
}

/* Floating Action Button (FAB) */
.map-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--fg-accent-color);
  color: white;
  border: none;
  border-radius: 30px;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(var(--fg-accent-color-rgb), 0.4);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  z-index: 20;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(var(--fg-accent-color-rgb), 0.5);
  }

  &:active {
    transform: translateY(0);
  }

  .iconify {
    font-size: 1.2rem;
  }
}

@media (max-width: 600px) {
  .map-fab {
    bottom: 20px;
    right: 20px;
    padding: 12px;
    border-radius: 50%;

    .fab-text {
      display: none;
    }
  }
}
</style>
