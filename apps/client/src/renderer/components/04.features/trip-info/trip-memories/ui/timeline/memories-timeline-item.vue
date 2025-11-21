<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { ImageQuality } from '~/components/01.kit/kit-image-viewer/models/types'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { Icon } from '@iconify/vue'
import { onClickOutside, useStorage, useWindowSize } from '@vueuse/core'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { useMemoryImageViewer, useMemoryItemActions, useMorph } from '../../composables'

interface Props {
  memory: IMemory
  galleryImages?: ImageViewerImage[]
  isUnsorted?: boolean
  isViewMode?: boolean
  timelineGroups?: any[]
  isFullScreen?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  galleryImages: () => [],
  isUnsorted: false,
  isViewMode: false,
  timelineGroups: () => [],
  isFullScreen: false,
})

// --- 1. Morph & Quality Logic (Visuals) ---
const photoWrapperRef = ref<HTMLElement | null>(null)

const { width: windowWidth } = useWindowSize()
const { isMorphed, morphStyle, placeholderStyle, enterMorph, leaveMorph } = useMorph(photoWrapperRef)
const preferredQuality = useStorage<ImageQuality>('viewer-quality-preference', 'large')

const isDesktop = computed(() => windowWidth.value >= 1024)
const imageSrc = computed(() => {
  if (!props.memory.image)
    return ''

  if (isMorphed.value || props.isFullScreen) {
    switch (preferredQuality.value) {
      case 'medium':
        return props.memory.image.variants?.medium || props.memory.image.variants?.large || props.memory.image.url
      case 'large':
        return props.memory.image.variants?.large || props.memory.image.url
      case 'original':
        return props.memory.image.url
      default:
        return props.memory.image.variants?.large || props.memory.image.url
    }
  }

  // Стандартное поведение для ленты
  if (isDesktop.value)
    return props.memory.image.variants?.medium || props.memory.image.url
  return props.memory.image.variants?.small || props.memory.image.url
})

function setQuality(quality: ImageQuality) {
  preferredQuality.value = quality
}

function handleMorphTrigger() {
  if (isDesktop.value && photoWrapperRef.value)
    enterMorph()
}

watch(() => props.isFullScreen, () => {
  if (isMorphed.value)
    leaveMorph()
})

// --- 2. Memory Actions (Time, Comment, Delete) ---
const {
  memoryComment,
  saveComment,
  isTimeEditing,
  editingTime,
  displayTime,
  handleTimeClick,
  saveTime,
  handleDelete,
  handleRemoveTimestamp,
} = useMemoryItemActions({
  memory: props.memory,
  isViewMode: props.isViewMode,
})

const timeEditorRef = ref<HTMLElement | null>(null)
onClickOutside(timeEditorRef, saveTime)

// --- 3. Image Viewer Integration ---
const {
  imageViewer,
  activeViewerComment,
  activeViewerActivityTitle,
  activeViewerTime,
  formattedActiveViewerTime,
  openImageViewer,
  saveViewerComment,
  saveViewerTime,
} = useMemoryImageViewer({
  memory: props.memory,
  galleryImages: props.galleryImages,
  timelineGroups: props.timelineGroups,
  isTimeEditing,
  isMorphed,
})

const commentEditorRef = ref(null)
onClickOutside(commentEditorRef, saveViewerComment)

function handleWrapperClick() {
  if (isMorphed.value)
    leaveMorph()
  else
    openImageViewer()
}
</script>

<template>
  <div
    class="memory-item"
    :class="{
      'is-photo': memory.imageId,
      'is-note': !memory.imageId && !memory.title,
      'is-activity': memory.title,
      'is-unsorted': isUnsorted,
      'is-fullscreen-item': isFullScreen && memory.imageId,
    }"
  >
    <template v-if="memory.imageId && memory?.image?.url">
      <div v-if="isMorphed" class="morph-placeholder" :style="placeholderStyle" />

      <div
        ref="photoWrapperRef"
        class="photo-wrapper"
        :class="{ morphed: isMorphed }"
        :style="isMorphed ? morphStyle : {}"
        @click="handleWrapperClick"
      >
        <KitImage :src="imageSrc" object-fit="cover" />

        <!-- Кнопка открытия morph (скрыта при самом morph) -->
        <button
          v-if="isDesktop && !isFullScreen && !isMorphed"
          class="morph-trigger-btn"
          title="Приблизить"
          @click.stop="handleMorphTrigger"
        >
          <Icon icon="mdi:eye-outline" />
        </button>

        <!-- Контролы качества (видны только при morph) -->
        <div v-if="isMorphed" class="quality-controls" @click.stop>
          <button
            class="quality-btn"
            :class="{ active: preferredQuality === 'medium' }"
            title="Среднее качество"
            @click="setQuality('medium')"
          >
            <Icon icon="mdi:quality-medium" />
          </button>
          <button
            class="quality-btn"
            :class="{ active: preferredQuality === 'large' }"
            title="Высокое качество"
            @click="setQuality('large')"
          >
            <Icon icon="mdi:quality-high" />
          </button>
          <button
            class="quality-btn"
            :class="{ active: preferredQuality === 'original' }"
            title="Оригинал"
            @click="setQuality('original')"
          >
            <Icon icon="mdi:raw" />
          </button>
        </div>

        <div class="photo-overlay">
          <div v-if="memoryComment" class="memory-comment-overlay">
            <p>{{ memoryComment }}</p>
          </div>
          <div v-if="!isUnsorted && displayTime" class="memory-meta-badge">
            <div v-if="isTimeEditing" ref="timeEditorRef" class="time-editor-inline">
              <KitTimeField v-if="editingTime" v-model="editingTime" />
              <button class="save-time-btn-inline" @click.stop="saveTime">
                <Icon icon="mdi:check" />
              </button>
            </div>
            <span v-else @click.stop="handleTimeClick">{{ displayTime }}</span>
          </div>
          <div class="memory-actions">
            <button v-if="!isViewMode && memory.timestamp" title="Убрать временную метку" @click.stop="handleRemoveTimestamp">
              <Icon icon="mdi:calendar-remove-outline" />
            </button>
            <button v-if="!isViewMode" title="Удалить" @click.stop="handleDelete">
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="isUnsorted" class="unsorted-time-setter">
        <Icon height="18" width="18" icon="mdi:clock-plus-outline" />
        <div v-if="isTimeEditing" ref="timeEditorRef" class="time-editor-container">
          <KitTimeField v-if="editingTime" v-model="editingTime" />
          <button class="save-time-btn" @click="saveTime">
            OK
          </button>
        </div>
        <div v-else class="time-placeholder" @click="handleTimeClick">
          <span>Введите время</span>
        </div>
      </div>
    </template>

    <template v-if="!memory.imageId && !memory.title">
      <div class="memory-content">
        <div class="memory-comment">
          <KitInlineMdEditorWrapper
            v-model="memoryComment"
            :readonly="isViewMode"
            :features="{
              'block-edit': false,
              'image-block': false,
              'list-item': false,
              'link-tooltip': false,
              'toolbar': false,
            }"
            placeholder="Заметка..."
            class="comment-editor"
            @blur="saveComment"
          />
        </div>
      </div>
      <div class="note-footer" :class="{ isEditing: !isViewMode }">
        <div v-if="!isUnsorted && displayTime" class="memory-meta">
          <div v-if="isTimeEditing" ref="timeEditorRef" class="time-editor-inline">
            <KitTimeField v-if="editingTime" v-model="editingTime" />
            <button class="save-time-btn-inline" @click.stop="saveTime">
              <Icon icon="mdi:check" />
            </button>
          </div>
          <span v-else @click.stop="handleTimeClick">{{ displayTime }}</span>
        </div>
        <div v-if="!isViewMode" class="memory-actions is-note-actions">
          <button v-if="memory.timestamp" title="Убрать временную метку" @click="handleRemoveTimestamp">
            <Icon icon="mdi:calendar-remove-outline" />
          </button>
          <button title="Удалить" @click="handleDelete">
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </div>
      </div>
    </template>

    <template v-if="memory.title && memory.imageId" />

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
  </div>
</template>

<style scoped lang="scss">
.memory-item {
  position: relative;
  border-radius: var(--r-m);
  background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
  overflow: hidden;

  &.is-activity:not(.is-photo) {
    display: none;
  }

  &.is-note {
    position: relative;
    display: flex;
    padding: 4px;
    gap: 8px;
    min-height: auto;
    grid-column: 1 / -1;
    width: 100%;

    .note-footer {
      position: absolute;
      bottom: 4px;
      right: 16px;
      gap: 12px;
      width: auto;

      &.isEditing {
        position: relative;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: center;
        bottom: 0px;
        right: 0px;

        .memory-meta {
          margin-top: auto;
        }
      }
      &:not(.isEditing) {
        right: 4px;
        bottom: 8px;
        background-color: var(--bg-secondary-color);
        border-radius: var(--r-full);
        border: 1px solid var(--border-secondary-color);
        padding: 0 8px;
      }
    }
  }

  &.is-photo {
    display: flex;
    flex-direction: column;
    height: 300px;
    cursor: pointer;

    @include media-down(sm) {
      height: 180px;
    }
  }

  &.is-fullscreen-item {
    height: 600px;
  }

  &.is-unsorted {
    height: auto;
    cursor: default;
  }
}

.morph-placeholder {
  flex-shrink: 0;
  background-color: var(--bg-secondary-color);
}

.photo-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: var(--r-m);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  background-color: var(--bg-tertiary-color);

  &.morphed {
    cursor: zoom-out;
    border-radius: var(--r-s);
  }

  .is-unsorted & {
    height: 200px;
  }

  :deep(img) {
    transition: transform 0.3s ease;
  }

  &:hover:not(.morphed) :deep(img) {
    transform: scale(1.05);
  }
}

.morph-trigger-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 4;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-in;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

.photo-wrapper:hover:not(.morphed) .morph-trigger-btn {
  opacity: 1;
  pointer-events: auto;
}

.quality-controls {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 1;
  }
}

.quality-btn {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
  }

  &.active {
    background: var(--fg-accent-color);
    color: white;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}

/* --- Overlays --- */
.photo-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 40%),
      linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, transparent 30%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
}

.photo-wrapper:hover:not(.morphed) .photo-overlay::before,
.photo-wrapper.morphed .photo-overlay::before {
  opacity: 1;
}

.memory-comment-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 12px 12px;
  color: white;
  font-size: 0.9rem;
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  z-index: 2;

  .photo-wrapper:hover:not(.morphed) &,
  .photo-wrapper.morphed & {
    opacity: 1;
    transform: translateY(0);
  }

  p {
    margin: 0;
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
  }
}

.memory-meta-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  padding: 4px 8px;
  border-radius: var(--r-full);
  z-index: 3;
  transition: background-color 0.2s ease;
  line-height: 20px;
  pointer-events: auto;

  :deep(.kit-time-field) {
    background-color: transparent;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  @include media-down(sm) {
    font-size: 0.7rem;
    top: 4px;
    right: 4px;
    line-height: 16px;
    padding: 2px 6px;
  }
}

.memory-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
  width: 100%;
}

.memory-meta {
  color: var(--fg-secondary-color);
  font-size: 0.75rem;

  > span {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--r-2xs);
    transition: background-color 0.2s ease;
  }

  .time-editor-inline {
    :deep(.kit-time-field) {
      background-color: var(--bg-tertiary-color);
    }
  }
}

.memory-comment {
  width: 100%;

  .comment-editor {
    border-radius: 10px;
    overflow: hidden;

    :deep(.milkdown .editor) {
      padding: 4px;
      font-size: 0.9rem;
      color: var(--fg-primary-color);
      white-space: pre-wrap;
      line-height: 1.5;
      min-height: 28px;
      p {
        margin: 0;
      }
      &:hover {
        background-color: var(--bg-hover-color);
      }
    }
    :deep(.prosemirror-editor-wrapper[readonly]) .editor:hover {
      background-color: transparent;
    }
  }
}

.memory-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  gap: 4px;
  pointer-events: none;

  .photo-wrapper:hover:not(.morphed) & {
    opacity: 1;
    pointer-events: auto;
  }

  &.is-note-actions {
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    opacity: 0;
    pointer-events: auto;
    transition: opacity 0.2s ease;

    @include media-down(sm) {
      opacity: 1;
    }

    .memory-item:hover & {
      opacity: 1;
    }
  }

  button {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--r-full);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: all 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
      border-color: white;
    }
  }

  button[title='Удалить']:hover {
    color: var(--fg-error-color);
    border-color: var(--fg-error-color);
  }

  @include media-down(sm) {
    opacity: 1;
    pointer-events: auto;
  }
}

.time-editor-inline {
  display: flex;
  align-items: center;
  gap: 4px;

  :deep(.time-field) {
    background-color: transparent;
  }

  .save-time-btn-inline {
    background: var(--fg-accent-color);
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.unsorted-time-setter {
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-tertiary-color);

  .time-placeholder {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--fg-accent-color);
    cursor: pointer;
    font-weight: 500;
    font-size: 0.8rem;
  }
  .time-editor-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;

    .save-time-btn {
      padding: 4px 10px;
      border-radius: var(--r-s);
      background-color: var(--fg-accent-color);
      color: white;
      margin-left: auto;
    }
  }
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
    background: var(--bg-tertiary-color);
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
        border-radius: 10px;
        overflow: hidden;
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
