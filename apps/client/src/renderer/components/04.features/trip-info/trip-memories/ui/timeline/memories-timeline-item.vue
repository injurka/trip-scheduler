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
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
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

const photoWrapperRef = ref<HTMLElement | null>(null)
const commentEditorRef = ref(null)
const timeEditorRef = ref<HTMLElement | null>(null)
const ratingMenuRef = ref<HTMLElement | null>(null)

const { memories: memoriesStore } = useModuleStore(['memories'])
const { isLocalModeEnabled, localBlobUrls } = storeToRefs(memoriesStore)

const { width: windowWidth } = useWindowSize()
const { isMorphed, morphStyle, placeholderStyle, enterMorph, leaveMorph } = useMorph(photoWrapperRef)
const preferredQuality = useStorage<ImageQuality>('viewer-quality-preference', 'large')

const isDesktop = computed(() => windowWidth.value >= 1024)

const imageSrc = computed(() => {
  if (!props.memory.image)
    return ''

  // Если включен локальный режим и есть скачанный Blob
  if (isLocalModeEnabled.value && props.memory.imageId && localBlobUrls.value.has(props.memory.imageId)) {
    return localBlobUrls.value.get(props.memory.imageId)
  }

  // Обычная логика (серверные URL)
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

const {
  memoryComment,
  saveComment,
  saveRating,
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

function handleWrapperClick() {
  if (isMorphed.value)
    leaveMorph()
  else
    openImageViewer()
}

const isRatingMenuOpen = ref(false)
const hoveredRating = ref(0)

function toggleRatingMenu() {
  if (props.isViewMode)
    return
  isRatingMenuOpen.value = !isRatingMenuOpen.value
}

function handleRate(star: number) {
  saveRating(star)
  isRatingMenuOpen.value = false
}

function getStarIcon(star: number) {
  const currentVal = hoveredRating.value || props.memory.rating || 0
  return star <= currentVal ? 'mdi:star' : 'mdi:star-outline'
}

watch(() => props.isFullScreen, () => {
  if (isMorphed.value)
    leaveMorph()
})

onClickOutside(commentEditorRef, saveViewerComment)
onClickOutside(timeEditorRef, saveTime)
onClickOutside(ratingMenuRef, () => isRatingMenuOpen.value = false)
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

        <button
          v-if="isDesktop && !isFullScreen && !isMorphed"
          class="morph-trigger-btn"
          @click.stop="handleMorphTrigger"
        >
          <div class="icon-wrapper">
            <Icon icon="mdi:eye-outline" class="morph-icon" />
          </div>
          <span>Приблизить</span>
        </button>

        <div v-if="isMorphed && !isLocalModeEnabled" class="quality-controls" @click.stop>
          <button
            class="quality-btn"
            :class="{ active: preferredQuality === 'medium' }"
            @click="setQuality('medium')"
          >
            <div class="icon-wrapper">
              <Icon icon="mdi:quality-medium" />
            </div>
            <span>Среднее</span>
          </button>

          <button
            class="quality-btn"
            :class="{ active: preferredQuality === 'large' }"
            @click="setQuality('large')"
          >
            <div class="icon-wrapper">
              <Icon icon="mdi:quality-high" />
            </div>
            <span>Высокое</span>
          </button>

          <button
            class="quality-btn"
            :class="{ active: preferredQuality === 'original' }"
            @click="setQuality('original')"
          >
            <div class="icon-wrapper">
              <Icon icon="mdi:raw" />
            </div>
            <span>Оригинал</span>
          </button>
        </div>
        <div v-else-if="isMorphed && isLocalModeEnabled" class="quality-controls" @click.stop>
          <div class="quality-badge-local">
            <Icon icon="mdi:harddisk" />
            <span>Локальный файл</span>
          </div>
        </div>

        <div class="photo-overlay">
          <div v-if="memoryComment" class="memory-comment-overlay">
            <p>{{ memoryComment }}</p>
          </div>

          <div class="memory-top-bar" :class="{ 'has-content': !isUnsorted && displayTime }">
            <div
              v-if="!isUnsorted && (!isViewMode || memory.rating)"
              ref="ratingMenuRef"
              class="rating-wrapper"
            >
              <button
                class="rating-trigger-btn"
                :class="{ 'has-rating': !!memory.rating }"
                :disabled="isViewMode"
                @click.stop="toggleRatingMenu"
              >
                <Icon :icon="memory.rating ? 'mdi:star' : 'mdi:star-outline'" class="star-icon" />
                <span v-if="memory.rating" class="rating-value">{{ memory.rating }}</span>
              </button>

              <Transition name="fade">
                <div v-if="isRatingMenuOpen" class="rating-popup" @click.stop>
                  <button
                    v-for="star in 5"
                    :key="star"
                    class="popup-star-btn"
                    @click="handleRate(star)"
                    @mouseenter="hoveredRating = star"
                    @mouseleave="hoveredRating = 0"
                  >
                    <Icon :icon="getStarIcon(star)" />
                  </button>
                </div>
              </Transition>
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

.memory-top-bar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;

  @include media-down(sm) {
    top: 6px;
    right: 6px;
    gap: 4px;
  }
}

.rating-wrapper {
  position: relative;
  opacity: 0;
  transform: translateY(-5px);
  transition: all 0.2s ease;

  .photo-wrapper:hover:not(.morphed) & {
    opacity: 1;
    transform: translateY(0);
  }

  &:has(.rating-popup) {
    opacity: 1;
    transform: translateY(0);
  }
}

.rating-trigger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  height: 28px;
  padding: 0 8px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;

  font-size: 0.8rem;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.7);
  }

  &.has-rating {
    background: rgba(255, 215, 0, 0.2);
    color: #ffd700;
    border: 1px solid rgba(255, 215, 0, 0.3);
  }

  .star-icon {
    font-size: 1rem;
    margin-top: -1px;
  }

  @include media-down(sm) {
    height: 24px;
    padding: 0 6px;
    border-radius: 12px;
    font-size: 0.75rem;

    .star-icon {
      font-size: 0.9rem;
    }
  }
}

.rating-popup {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  padding: 6px 10px;
  border-radius: 20px;
  display: flex;
  gap: 4px;
  box-shadow: var(--s-m);
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.1);

  .popup-star-btn {
    background: none;
    border: none;
    padding: 2px;
    color: #ffd700;
    cursor: pointer;
    font-size: 1.2rem;
    transition: transform 0.1s;
    display: flex;
    align-items: center;

    &:hover {
      transform: scale(1.2);
    }
  }
}

.memory-meta-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  height: 28px;
  padding: 0 8px;
  border-radius: 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  transition: background-color 0.2s ease;
  pointer-events: auto;

  :deep(.kit-time-field) {
    background-color: transparent;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  @include media-down(sm) {
    height: 24px;
    padding: 0 6px;
    font-size: 0.75rem;
    border-radius: 12px;
  }
}

.morph-trigger-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 4;
  opacity: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  border-radius: 32px;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: zoom-in;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  transition:
    opacity 0.2s ease,
    width 0.3s ease,
    background-color 0.2s ease;

  .icon-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .morph-icon {
    flex-shrink: 0;
  }

  span {
    opacity: 0;
    white-space: nowrap;
    max-width: 0;
    overflow: hidden;
    margin-left: 0;
    font-size: 0.85rem;
    font-weight: 500;
    transition:
      opacity 0.2s ease 0.1s,
      max-width 0.3s ease,
      margin-left 0.2s ease;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    width: 130px;

    span {
      opacity: 1;
      max-width: 100px;
      margin-left: 0px;
    }
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
  flex-direction: column;
  gap: 8px;
  opacity: 0.6;
  transition: opacity 0.3s ease;

  &:hover {
    opacity: 1;
  }
}

.quality-badge-local {
  background: rgba(0, 150, 0, 0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 32px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.quality-btn {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 32px;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 1.1rem;
  cursor: pointer;
  overflow: hidden;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    width 0.3s ease,
    transform 0.2s ease;

  .icon-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  span {
    opacity: 0;
    white-space: nowrap;
    max-width: 0;
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 500;
    margin-left: 0;
    transition:
      opacity 0.2s ease 0.1s,
      max-width 0.3s ease,
      margin-left 0.2s ease;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-color: rgba(255, 255, 255, 0.4);
    width: auto;
    padding-right: 12px;

    span {
      opacity: 1;
      max-width: 80px;
      margin-left: 0;
    }
  }

  &.active {
    background: var(--fg-accent-color);
    color: white;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    opacity: 1;
  }
}

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
