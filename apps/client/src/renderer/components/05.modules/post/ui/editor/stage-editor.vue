<script setup lang="ts">
import type { PostMedia, TimelineBlockType, TimelineStage } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { parseTime } from '@internationalized/date'
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { usePostDraftStore } from '../../store/post-draft.store'
import AddBlockMenu from './add-block-menu.vue'
import GalleryEditor from './blocks/gallery-editor.vue'
import LocationEditor from './blocks/location-editor.vue'
import RouteEditor from './blocks/route-editor.vue'

const props = defineProps<{ stage: TimelineStage & { day?: number }, index: number }>()
const store = usePostDraftStore()

const blocksModel = computed({
  get: () => props.stage.blocks,
  set: (val) => {
    // eslint-disable-next-line vue/no-mutating-props
    props.stage.blocks = val
  },
})

const stageTimeModel = computed({
  get: () => {
    if (!props.stage.time)
      return null
    try {
      return parseTime(props.stage.time.length === 5 ? `${props.stage.time}:00` : props.stage.time)
    }
    catch {
      return null
    }
  },
  set: (val) => {
    store.updateStage(props.stage.id, { time: val ? val.toString().slice(0, 5) : '' })
  },
})

function handleAddBlock(type: TimelineBlockType) {
  store.addBlock(props.stage.id, type)
}

function getBlockIcon(type: TimelineBlockType) {
  switch (type) {
    case 'text': return 'mdi:text'
    case 'gallery': return 'mdi:image-multiple'
    case 'location': return 'mdi:map-marker'
    case 'route': return 'mdi:directions'
    default: return 'mdi:cube-outline'
  }
}

function getBlockTitle(type: TimelineBlockType) {
  switch (type) {
    case 'text': return 'Текст'
    case 'gallery': return 'Галерея'
    case 'location': return 'Локация'
    case 'route': return 'Маршрут'
    default: return 'Блок'
  }
}
</script>

<template>
  <div class="stage-editor">
    <div class="stage-header">
      <div class="drag-handle">
        <Icon icon="mdi:drag" />
      </div>
      <div class="stage-meta">
        <div class="compact-day-time">
          <div class="day-wrapper" title="День маршрута">
            <span class="label">Дн</span>
            <input
              :value="'day' in stage ? stage.day : 1"
              type="number"
              class="bare-input"
              @input="e => store.updateStage(stage.id, { day: Number((e.target as HTMLInputElement).value) } as any)"
            >
          </div>
          <div class="divider" />
          <KitTimeField
            v-model="stageTimeModel"
            class="bare-time"
          />
        </div>

        <KitInput
          :model-value="stage.title"
          placeholder="Название этапа (напр. Завтрак)"
          class="stage-title-input"
          size="sm"
          @update:model-value="val => store.updateStage(stage.id, { title: val as string })"
        />
      </div>
      <button class="delete-btn" @click="store.removeStage(index)">
        <Icon icon="mdi:close" />
      </button>
    </div>

    <div class="blocks-container">
      <draggable
        v-model="blocksModel"
        item-key="id"
        class="blocks-container-wrapper"
        handle=".block-drag-handle"
        ghost-class="ghost-block"
        group="stage-blocks"
      >
        <template #item="{ element: block }">
          <div class="block-item">
            <!-- НОВАЯ ШАПКА БЛОКА ДЛЯ УЛУЧШЕНИЯ UI/UX -->
            <div class="block-actions-bar">
              <div class="block-drag-handle" title="Потяните для сортировки">
                <Icon icon="mdi:drag-horizontal" />
              </div>
              <div class="block-type-label">
                <Icon :icon="getBlockIcon(block.type)" class="type-icon" />
                <span>{{ getBlockTitle(block.type) }}</span>
              </div>
              <button class="remove-block-btn" title="Удалить блок" @click="store.removeBlock(stage.id, block.id)">
                <Icon icon="mdi:close" width="16" height="16" />
              </button>
            </div>

            <div class="block-content">
              <template v-if="block.type === 'text'">
                <KitInlineMdEditorWrapper
                  :model-value="block.content"
                  placeholder="Опишите этот момент..."
                  @update:model-value="val => store.updateBlock(stage.id, block.id, { content: val })"
                />
              </template>

              <template v-if="block.type === 'gallery'">
                <GalleryEditor
                  :images="block.images"
                  :display-type="block.displayType"
                  @update:images="(val: PostMedia[]) => store.updateBlock(stage.id, block.id, { images: val })"
                  @update:display-type="(val: string) => store.updateBlock(stage.id, block.id, { displayType: val as any })"
                />
                <KitInput
                  :model-value="block.comment"
                  placeholder="Комментарий к галерее..."
                  size="sm"
                  class="mt-2"
                  @update:model-value="val => store.updateBlock(stage.id, block.id, { comment: val ? String(val) : '' })"
                />
              </template>

              <template v-if="block.type === 'location'">
                <LocationEditor
                  :block="block"
                  @update="payload => store.updateBlock(stage.id, block.id, payload)"
                />
              </template>

              <template v-if="block.type === 'route'">
                <RouteEditor
                  :block="block"
                  @update="payload => store.updateBlock(stage.id, block.id, payload)"
                />
              </template>
            </div>
          </div>
        </template>
      </draggable>

      <AddBlockMenu @select="handleAddBlock" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.stage-editor {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  margin-bottom: 16px;
  overflow: hidden;
}

.stage-header {
  display: flex;
  align-items: center;
  padding: 8px;
  background: var(--bg-tertiary-color);
  gap: 8px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.drag-handle {
  cursor: grab;
  color: var(--fg-tertiary-color);
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
}

.stage-meta {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}

.compact-day-time {
  display: flex;
  align-items: center;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  height: 38px;
  gap: 4px;
  flex-shrink: 0;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--border-focus-color);
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border-secondary-color);
    margin: 0 2px;
  }

  .day-wrapper {
    display: flex;
    align-items: center;
    padding-left: 8px;

    .label {
      font-size: 0.75rem;
      color: var(--fg-tertiary-color);
      font-weight: 600;
      margin-right: 2px;
    }

    .bare-input {
      border: none;
      background: transparent;
      color: var(--fg-primary-color);
      font-weight: 600;
      font-size: 0.875rem;
      width: 24px;
      text-align: center;
      outline: none;
      padding: 0;

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }

  :deep(.bare-time.kit-time-field) {
    border: none;
    background: transparent;
    padding: 0 8px 0 4px;
    height: 100%;
    min-height: unset;
  }

  .bare-time {
    margin-right: 8px;
  }
}

.stage-title-input {
  flex: 1;
}

.delete-btn {
  color: var(--fg-tertiary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: var(--fg-error-color);
  }
}

.blocks-container {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

/* === ОБНОВЛЕННЫЙ ВНЕШНИЙ ВИД БЛОКОВ === */
.block-item {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  overflow: hidden;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    box-shadow: var(--s-s);
  }
}

.block-actions-bar {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary-color);
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.block-drag-handle {
  cursor: grab;
  color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin-right: 4px;
  border-radius: 4px;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &:active {
    cursor: grabbing;
  }
}

.block-type-label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;

  .type-icon {
    font-size: 1rem;
  }
}

.remove-block-btn {
  color: var(--fg-tertiary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-error-color);
    background: rgba(var(--bg-error-color-rgb), 0.1);
  }
}

.block-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ghost-block {
  opacity: 0.5;
  background: var(--bg-accent-color);
}

.mt-2 {
  margin-top: 8px;
}

@media (max-width: 600px) {
  .stage-header {
    align-items: flex-start;
  }

  .stage-meta {
    flex-wrap: wrap;
    gap: 8px;
  }

  .compact-day-time {
    width: 100%;
  }

  .stage-title-input {
    width: 100%;
    flex: 100%;
  }

  .drag-handle,
  .delete-btn {
    margin-top: 8px;
  }
}
</style>
