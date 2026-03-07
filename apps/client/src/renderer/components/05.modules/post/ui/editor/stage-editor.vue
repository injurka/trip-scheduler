<script setup lang="ts">
import type { PostMedia, TimelineBlockType, TimelineStage } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { usePostDraftStore } from '../../store/post-draft.store'
import AddBlockMenu from './add-block-menu.vue'
import GalleryEditor from './blocks/gallery-editor.vue'
import LocationEditor from './blocks/location-editor.vue'
import RouteEditor from './blocks/route-editor.vue'

const props = defineProps<{ stage: TimelineStage, index: number }>()
const store = usePostDraftStore()

const blocksModel = computed({
  get: () => props.stage.blocks,
  set: (val) => {
    // eslint-disable-next-line vue/no-mutating-props
    props.stage.blocks = val
  },
})

function handleAddBlock(type: TimelineBlockType) {
  store.addBlock(props.stage.id, type)
}
</script>

<template>
  <div class="stage-editor">
    <div class="stage-header">
      <div class="drag-handle">
        <Icon icon="mdi:drag" />
      </div>
      <div class="stage-meta">
        <KitInput
          :model-value="stage.title"
          placeholder="Название этапа (напр. Завтрак)"
          class="stage-title-input"
          size="sm"
          @update:model-value="val => store.updateStage(stage.id, { title: val as string })"
        />
        <KitInput
          :model-value="stage.time"
          placeholder="Время (опц.)"
          class="stage-time-input"
          size="sm"
          @update:model-value="val => store.updateStage(stage.id, { time: val as string })"
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
            <div class="block-drag-handle">
              <Icon icon="mdi:drag-horizontal" />
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
                  @update:images="(val: PostMedia[]) => store.updateBlock(stage.id, block.id, { images: val })"
                />
                <KitInput
                  :model-value="block.comment"
                  placeholder="Комментарий к галерее..."
                  size="sm"
                  class="mt-2"
                  @update:model-value="val => store.updateBlock(stage.id, block.id, { comment: val })"
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

            <button class="remove-block-btn" @click="store.removeBlock(stage.id, block.id)">
              <Icon icon="mdi:trash-can-outline" width="16" height="16" />
            </button>
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
}
.stage-title-input {
  flex: 2;
}
.stage-time-input {
  flex: 1;
  max-width: 100px;
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
  gap: 8px;

  &-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.block-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.block-drag-handle {
  cursor: grab;
  color: var(--fg-tertiary-color);
  padding-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.block-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.remove-block-btn {
  color: var(--fg-error-color);
  transition: opacity 0.2s;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-placeholder {
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--fg-tertiary-color);
}

.route-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  .arrow-icon {
    color: var(--fg-tertiary-color);
  }
}

.ghost-block {
  opacity: 0.5;
  background: var(--bg-accent-color);
}

.mt-2 {
  margin-top: 8px;
}

/* === Mobile Adaptations === */
@media (max-width: 600px) {
  .stage-header {
    align-items: flex-start; /* Align drag/del icons to top */
  }

  .stage-meta {
    flex-direction: column; /* Stack Title and Time vertically */
    gap: 8px;
  }

  .stage-title-input,
  .stage-time-input {
    flex: 1;
    max-width: 100%;
    width: 100%;
  }

  .drag-handle,
  .delete-btn {
    margin-top: 8px;
  }
}
</style>
