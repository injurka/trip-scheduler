<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { KitImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { useModuleStore } from '~/components/05.modules/trip-info'
import { useSharedMemoryViewer } from '../../composables'
import { SHARED_VIEWER_KEY } from '../../lib'
import MemoriesTimelineGroup from './memories-timeline-group.vue'

interface Props {
  isViewMode: boolean
  galleryImages: ImageViewerImage[]
  isFullScreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullScreen: false,
})

const { ui, memories: memoriesStore } = useModuleStore(['ui', 'memories'])
const { timelineGroupsForSelectedDay: timelineGroups } = storeToRefs(memoriesStore)

const {
  imageViewer,
  activeViewerComment,
  activeViewerActivityTitle,
  activeViewerTime,
  formattedActiveViewerTime,
  openImageViewer,
  saveViewerComment,
  saveViewerTime,
} = useSharedMemoryViewer({
  galleryImages: toRef(props, 'galleryImages'),
  timelineGroups,
})

provide(SHARED_VIEWER_KEY, { openImageViewer })

const commentEditorRef = ref(null)
onClickOutside(commentEditorRef, saveViewerComment)
</script>

<template>
  <div class="timeline-section">
    <MemoriesTimelineGroup
      v-for="group in timelineGroups"
      :key="group.type + group.activity?.id + group.title"
      :group="group"
      :is-view-mode="isViewMode"
      :is-collapsed="ui.collapsedMemoryGroups.has(group.type + group.activity?.id + group.title)"
      :is-full-screen="isFullScreen"
      @toggle-collapse="ui.toggleMemoryGroupCollapsed(group.type + group.activity?.id + group.title)"
    />
  </div>

  <KitImageViewer
    v-model:visible="imageViewer.isOpen.value"
    v-model:current-index="imageViewer.currentIndex.value"
    :images="imageViewer.images.value"
    :close-on-overlay-click="true"
  >
    <template #footer="{ image }">
      <div v-if="image.meta" class="viewer-custom-footer" :class="{ 'is-readonly': isViewMode }">
        <div class="viewer-comment-section">
          <div v-if="!isViewMode" ref="commentEditorRef">
            <KitInlineMdEditorWrapper
              v-model="activeViewerComment"
              :readonly="isViewMode"
              :features="{
                'block-edit': false,
                'image-block': false,
                'list-item': false,
                'link-tooltip': false,
                'toolbar': false,
              }"
              placeholder="Комментарий..."
              class="viewer-comment-editor"
            />
          </div>
          <div v-else>
            <span class="activity-title">{{ activeViewerActivityTitle }}</span>
            <hr v-if="activeViewerComment && activeViewerActivityTitle">
            <span class="activity-comment">{{ activeViewerComment }}</span>
          </div>
        </div>
        <div class="viewer-time-section">
          <div v-if="!isViewMode || formattedActiveViewerTime" class="viewer-time-display">
            <KitTimeField
              v-if="!isViewMode"
              v-model="activeViewerTime"
              :readonly="isViewMode"
              @blur="saveViewerTime"
            />
            <template v-else>
              <span>{{ formattedActiveViewerTime }}</span>
              <Icon height="19" width="19" icon="mdi:clock-outline" class="time-icon" />
            </template>
          </div>
        </div>
      </div>
    </template>
  </KitImageViewer>
</template>

<style scoped lang="scss">
.timeline-section {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}

.viewer-custom-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  min-width: 210px;
  padding: 12px;
  background: var(--bg-tertiary-color);
  backdrop-filter: blur(5px);
  border-radius: var(--r-m);
  border: 1px solid var(--border-primary-color);
  color: var(--fg-primary-color);
  max-width: 600px;
  margin: 20px auto 0;
  transition: all 0.2s ease;
  width: 100%;
  opacity: 0.7;

  &.is-readonly {
    gap: 8px;
    padding: 12px 16px;
    text-align: center;
  }

  &:hover {
    opacity: 1;
  }
}

.viewer-comment-section {
  flex-grow: 1;
  color: var(--fg-secondary-color);
  transition: color 0.2s ease;

  .activity-comment {
    font-size: 0.9rem;
  }

  .activity-title {
    font-size: 1rem;
    color: var(--fg-primary-color);
  }

  hr {
    border: 1px solid var(--border-secondary-color);
    width: 90%;
    margin: 8px auto;
  }

  &:hover {
    color: var(--fg-primary-color);
  }
}

.viewer-time-section {
  flex-shrink: 0;
}

.viewer-comment-editor {
  :deep(.milkdown) {
    --crepe-color-on-background: var(--fg-primary-color);

    .editor {
      padding: 8px;
      border-radius: var(--r-s);
      min-height: 48px;
      transition: background-color 0.2s ease;

      p {
        margin: 0;
        font-size: 0.9rem;
      }
    }

    &:not([readonly]) .editor:hover {
      background-color: var(--bg-hover-color);
    }
  }

  &.is-readonly {
    font-size: 1rem;
    pointer-events: none;

    :deep(.milkdown .editor) {
      padding: 0;
    }
  }
}

.viewer-time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  width: 100px;
  opacity: 0.7;

  :deep(.kit-time-field) {
    background-color: transparent;
  }

  .is-readonly & {
    font-size: 1rem;
    width: auto;
    gap: 6px;
  }
}
</style>
