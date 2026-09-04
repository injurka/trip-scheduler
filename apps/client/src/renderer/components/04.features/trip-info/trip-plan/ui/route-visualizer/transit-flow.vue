<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import TransitEdge from './transit-edge.vue'
import TransitNode from './transit-node.vue'

interface Props {
  activities: IActivity[]
  orientation?: 'horizontal' | 'vertical'
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
  isEditMode: false,
})

const emit = defineEmits<{
  (e: 'selectActivity', activityId: string): void
  (e: 'editActivity', activity: IActivity): void
  (e: 'deleteActivity', activityId: string): void
  (e: 'reorderActivities', newOrder: IActivity[]): void
  (e: 'moveActivity', payload: { activity: IActivity, direction: 'up' | 'down' }): void
  (e: 'addActivity'): void
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)

const draggableList = computed({
  get: () => props.activities,
  set: (newVal: IActivity[]) => {
    emit('reorderActivities', newVal)
  },
})

function handleWheel(e: WheelEvent) {
  if (props.orientation !== 'horizontal' || !scrollContainerRef.value)
    return

  // Allow horizontal scroll with mouse wheel
  if (e.deltaY !== 0 && !e.shiftKey) {
    scrollContainerRef.value.scrollLeft += e.deltaY * 0.8
  }
}

function scrollLeft() {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollBy({ left: -300, behavior: 'smooth' })
  }
}

function scrollRight() {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollBy({ left: 300, behavior: 'smooth' })
  }
}
</script>

<template>
  <div
    class="transit-flow-container"
    :class="[
      `transit-flow--${orientation}`,
      { 'is-editing': isEditMode },
    ]"
  >
    <!-- Navigation scroll buttons for horizontal view -->
    <button
      v-if="orientation === 'horizontal' && activities.length > 3"
      class="flow-nav-btn prev"
      title="Прокрутить влево"
      @click="scrollLeft"
    >
      <Icon icon="mdi:chevron-left" />
    </button>
    <button
      v-if="orientation === 'horizontal' && activities.length > 3"
      class="flow-nav-btn next"
      title="Прокрутить вправо"
      @click="scrollRight"
    >
      <Icon icon="mdi:chevron-right" />
    </button>

    <!-- Empty State -->
    <div v-if="activities.length === 0" class="empty-flow-state">
      <Icon icon="mdi:map-marker-path" class="empty-icon" />
      <p class="empty-text">
        В этот день пока нет запланированных остановок
      </p>
      <KitBtn
        v-if="isEditMode"
        variant="solid"
        color="primary"
        size="sm"
        @click="emit('addActivity')"
      >
        <Icon icon="mdi:plus" />
        Добавить первую активность
      </KitBtn>
    </div>

    <!-- Draggable Flow List in Edit Mode -->
    <div
      v-else-if="isEditMode"
      ref="scrollContainerRef"
      class="flow-track-scrollable"
      @wheel="handleWheel"
    >
      <draggable
        v-model="draggableList"
        item-key="id"
        handle=".drag-handle"
        animation="200"
        ghost-class="flow-ghost-node"
        chosen-class="flow-chosen-node"
        class="flow-draggable-track"
        :class="`track--${orientation}`"
      >
        <template #item="{ element: activity, index }">
          <div class="flow-item-group" :class="`flow-item--${orientation}`">
            <TransitNode
              :activity="activity"
              :index="index"
              :is-first="index === 0"
              :is-last="index === activities.length - 1"
              :orientation="orientation"
              :is-edit-mode="true"
              @select="emit('selectActivity', $event)"
              @edit="emit('editActivity', $event)"
              @delete="emit('deleteActivity', $event)"
              @move-up="emit('moveActivity', { activity, direction: 'up' })"
              @move-down="emit('moveActivity', { activity, direction: 'down' })"
            />
            <TransitEdge
              v-if="index < activities.length - 1"
              :from-activity="activity"
              :to-activity="activities[index + 1]"
              :orientation="orientation"
              :is-edit-mode="true"
            />
          </div>
        </template>
      </draggable>

      <div class="flow-add-btn-wrapper" :class="`add-btn--${orientation}`">
        <button class="flow-add-node-btn" title="Добавить активность в конец дня" @click="emit('addActivity')">
          <Icon icon="mdi:plus" />
          <span>Добавить точку</span>
        </button>
      </div>
    </div>

    <!-- Static Flow List in View Mode -->
    <div
      v-else
      ref="scrollContainerRef"
      class="flow-track-scrollable"
      @wheel="handleWheel"
    >
      <div class="flow-static-track" :class="`track--${orientation}`">
        <template v-for="(activity, index) in activities" :key="activity.id">
          <TransitNode
            :activity="activity"
            :index="index"
            :is-first="index === 0"
            :is-last="index === activities.length - 1"
            :orientation="orientation"
            :is-edit-mode="false"
            @select="emit('selectActivity', $event)"
          />
          <TransitEdge
            v-if="index < activities.length - 1"
            :from-activity="activity"
            :to-activity="activities[index + 1]"
            :orientation="orientation"
            :is-edit-mode="false"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.transit-flow-container {
  position: relative;
  width: 100%;
  padding: 8px 0;

  &--horizontal {
    padding-top: 20px;
    padding-bottom: 12px;
  }
}

.flow-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--s-m);
  transition: all 0.2s ease;
  opacity: 0.85;

  @include hover {
    & {
      opacity: 1;
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background: var(--bg-primary-color);
      transform: translateY(-50%) scale(1.1);
    }
  }

  &.prev {
    left: -8px;
  }

  &.next {
    right: -8px;
  }
}

.flow-track-scrollable {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 4px;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 999px;

    &:hover {
      background-color: var(--fg-tertiary-color);
    }
  }
}

.flow-static-track,
.flow-draggable-track {
  display: flex;
  align-items: center;

  &.track--horizontal {
    flex-direction: row;
    align-items: center;
    gap: 0;
    min-width: max-content;
    padding: 0 8px;
  }

  &.track--vertical {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 0;
  }
}

.flow-item-group {
  display: flex;
  align-items: center;

  &.flow-item--horizontal {
    flex-direction: row;
  }

  &.flow-item--vertical {
    flex-direction: column;
    width: 100%;
  }
}

.flow-add-btn-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;

  &.add-btn--horizontal {
    margin-left: 16px;
  }

  &.add-btn--vertical {
    margin-top: 16px;
    width: 100%;
  }
}

.flow-add-node-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r-m);
  border: 1px dashed var(--fg-accent-color);
  background: rgba(var(--fg-accent-color-rgb), 0.05);
  color: var(--fg-accent-color);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  @include hover {
    & {
      background: rgba(var(--fg-accent-color-rgb), 0.15);
      border-style: solid;
      transform: translateY(-1px);
    }
  }
}

.empty-flow-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 12px;
  text-align: center;

  .empty-icon {
    font-size: 2.4rem;
    color: var(--fg-tertiary-color);
    opacity: 0.7;
  }

  .empty-text {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.flow-ghost-node {
  opacity: 0.4;
  transform: scale(0.96);
}

.flow-chosen-node {
  box-shadow: 0 0 16px var(--fg-accent-color);
  transform: scale(1.02);
}
</style>
