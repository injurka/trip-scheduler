<script setup lang="ts">
import type { PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useFileDialog } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { resolveApiUrl } from '~/shared/lib/url'
import { readStoredTimelineMedia } from '../../../lib/media-timeline'
import { usePostDraftStore } from '../../../store/post-draft.store'

interface Props {
  visible: boolean
  selectedIds?: string[]
  mode?: 'select' | 'manage'
  single?: boolean
  title?: string
  allowTimeline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedIds: () => [],
  mode: 'select',
  single: false,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', media: PostMedia[]): void
  (e: 'timeline', media: PostMedia[]): void
  (e: 'busy', value: boolean): void
}>()

const store = usePostDraftStore()
const confirm = useConfirm()
const { open, onChange } = useFileDialog({
  accept: 'image/*,video/*',
  multiple: true,
})

const { post } = storeToRefs(store)
const localSelectedIds = ref<string[]>([])
const captureDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const isFullscreen = ref(false)
const searchQuery = ref('')
const mediaTypeFilter = ref<'all' | PostMedia['type']>('all')
const previewMedia = ref<PostMedia | null>(null)
const isVideoPreviewOpen = ref(false)
const filteredMedia = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return post.value.media.filter((media) => {
    const matchesType = mediaTypeFilter.value === 'all' || media.type === mediaTypeFilter.value
    const matchesName = !query || (media.originalName || '').toLocaleLowerCase().includes(query)
    return matchesType && matchesName
  })
})
const displayedMedia = computed(() => {
  const media = post.value.media
  if (props.mode !== 'select')
    return media

  return media
    .map((item, index) => ({ item, index, capturedAt: readStoredTimelineMedia(item).capturedAt }))
    .sort((a, b) => {
      if (!a.capturedAt || !b.capturedAt)
        return a.capturedAt ? -1 : b.capturedAt ? 1 : a.index - b.index
      return a.capturedAt.localeCompare(b.capturedAt) || a.index - b.index
    })
    .map(({ item }) => item)
})
const visibleMediaIds = computed(() => new Set(filteredMedia.value.map(media => media.id)))
const hasActiveMediaFilters = computed(() => Boolean(searchQuery.value.trim()) || mediaTypeFilter.value !== 'all')
const allVisibleMediaSelected = computed(() => filteredMedia.value.length > 0
  && filteredMedia.value.every(media => localSelectedIds.value.includes(media.id)))
const imageCount = computed(() => post.value.media.filter(media => media.type === 'image').length)
const videoCount = computed(() => post.value.media.filter(media => media.type === 'video').length)
const videoPreviewUrl = computed(() => {
  const media = previewMedia.value

  return media ? resolveApiUrl(media.variants?.web || media.metadata?.variants?.web || media.url) : ''
})

const isProcessing = ref(false)
const processedCount = ref(0)
const totalToProcess = ref(0)

function toggleSelection(id: string) {
  if (props.mode === 'manage' && !props.allowTimeline)
    return

  if (props.single) {
    if (localSelectedIds.value.includes(id)) {
      localSelectedIds.value = []
    }
    else {
      localSelectedIds.value = [id]
    }
    return
  }

  if (localSelectedIds.value.includes(id)) {
    localSelectedIds.value = localSelectedIds.value.filter(sid => sid !== id)
  }
  else {
    localSelectedIds.value.push(id)
  }
}

function toggleVisibleSelection() {
  const visibleIds = visibleMediaIds.value
  if (allVisibleMediaSelected.value) {
    localSelectedIds.value = localSelectedIds.value.filter(id => !visibleIds.has(id))
    return
  }

  const selectedIds = new Set(localSelectedIds.value)
  visibleIds.forEach(id => selectedIds.add(id))
  localSelectedIds.value = post.value.media.filter(media => selectedIds.has(media.id)).map(media => media.id)
}

function clearMediaFilters() {
  searchQuery.value = ''
  mediaTypeFilter.value = 'all'
}

function handleConfirm() {
  const selectedMedia = post.value.media.filter(m => localSelectedIds.value.includes(m.id))
  emit('confirm', selectedMedia)
  emit('update:visible', false)
}

function togglePrivacy(media: PostMedia) {
  store.toggleMediaPrivacy(media.id)
}

function getMediaThumbnail(media: PostMedia) {
  if (media.type === 'video') {
    return media.variants?.poster || media.metadata?.variants?.poster || media.variants?.small || media.metadata?.variants?.small || media.url
  }
  return media.variants?.small || media.metadata?.variants?.small || media.url
}

function getMediaCaptureDateTime(media: PostMedia) {
  const capturedAt = readStoredTimelineMedia(media).capturedAt
  if (!capturedAt)
    return 'Дата не указана'

  const date = new Date(capturedAt)
  return Number.isFinite(date.getTime()) ? captureDateTimeFormatter.format(date) : 'Дата не указана'
}

function openVideoPreview(media: PostMedia) {
  previewMedia.value = media
  isVideoPreviewOpen.value = true
}

async function handleDelete(id: string) {
  const isConfirmed = await confirm({
    title: 'Удалить медиа из поста?',
    description: 'Оно пропадет из всех блоков. Это действие необратимо.',
    type: 'danger',
    confirmText: 'Да, удалить',
  })

  if (isConfirmed) {
    const removed = await store.removeGlobalMedia(id)
    if (!removed)
      return
    localSelectedIds.value = localSelectedIds.value.filter(sid => sid !== id)
  }
}

onChange(async (files) => {
  if (!files || files.length === 0 || isProcessing.value)
    return

  isProcessing.value = true
  emit('busy', true)
  try {
    totalToProcess.value = files.length
    processedCount.value = 0

    const filesArray = Array.from(files)

    for (const file of filesArray) {
      const added = await store.uploadSingleMedia(file)
      if (added && (props.mode === 'select' || props.allowTimeline)) {
        if (props.single) {
          localSelectedIds.value = [added.id]
        }
        else {
          localSelectedIds.value.push(added.id)
        }
      }
      processedCount.value++
    }
  }
  finally {
    isProcessing.value = false
    emit('busy', false)
  }
})

function handleTimeline() {
  emit('timeline', post.value.media.filter(media => localSelectedIds.value.includes(media.id)))
  emit('update:visible', false)
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    isFullscreen.value = false
    clearMediaFilters()
    localSelectedIds.value = [...props.selectedIds]
    void store.refreshMedia()
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="title || (mode === 'select' ? (single ? 'Выбрать обложку' : 'Выбрать медиа') : 'Медиатека поста')"
    icon="mdi:image-multiple-outline"
    :max-width="1100"
    :content-class="{ 'media-library-dialog--fullscreen': isFullscreen }"
    :persistent="true"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header-actions>
      <KitBtn
        variant="outlined"
        color="secondary"
        size="sm"
        class="media-library-fullscreen-toggle"
        :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
        :aria-label="isFullscreen ? 'Свернуть медиатеку' : 'Развернуть медиатеку на весь экран'"
        :aria-pressed="isFullscreen"
        @click="isFullscreen = !isFullscreen"
      >
        <span class="media-library-fullscreen-label">{{ isFullscreen ? 'Свернуть' : 'На весь экран' }}</span>
      </KitBtn>
    </template>

    <div class="library-container" :class="{ 'is-empty': !post.media.length, 'is-fullscreen': isFullscreen }">
      <div v-if="isProcessing" class="processing-overlay">
        <Icon icon="mdi:loading" class="spin" />
        <p>Загрузка медиафайлов ({{ processedCount }} / {{ totalToProcess }})...</p>
      </div>

      <div v-if="post.media.length" class="media-toolbar">
        <div class="stats">
          <strong>{{ post.media.length }} файлов</strong>
          <span v-if="hasActiveMediaFilters">Показано: {{ filteredMedia.length }}</span>
          <span v-if="localSelectedIds.length" class="selected-summary">Выбрано: {{ localSelectedIds.length }}</span>
        </div>
        <div class="toolbar-actions">
          <KitBtn variant="tonal" size="sm" icon="mdi:plus" :disabled="isProcessing" @click="open()">
            Добавить медиа
          </KitBtn>

          <KitBtn v-if="!single && (mode === 'select' || allowTimeline)" variant="text" color="secondary" size="sm" :disabled="isProcessing || !filteredMedia.length" @click="toggleVisibleSelection">
            {{ allVisibleMediaSelected ? 'Снять видимые' : 'Выбрать видимые' }}
          </KitBtn>
        </div>

        <div class="media-search-wrap">
          <KitInput
            v-model="searchQuery"
            icon="mdi:magnify"
            size="sm"
            placeholder="Поиск по имени файла"
            aria-label="Поиск по имени файла"
          />
        </div>
        <div class="media-type-filters" role="group" aria-label="Фильтр по типу медиа">
          <button type="button" class="media-filter" :class="{ active: mediaTypeFilter === 'all' }" :aria-pressed="mediaTypeFilter === 'all'" @click="mediaTypeFilter = 'all'">
            Все <span class="filter-count">{{ post.media.length }}</span>
          </button>
          <button type="button" class="media-filter" :class="{ active: mediaTypeFilter === 'image' }" :aria-pressed="mediaTypeFilter === 'image'" @click="mediaTypeFilter = 'image'">
            Фото <span class="filter-count">{{ imageCount }}</span>
          </button>
          <button type="button" class="media-filter" :class="{ active: mediaTypeFilter === 'video' }" :aria-pressed="mediaTypeFilter === 'video'" @click="mediaTypeFilter = 'video'">
            Видео <span class="filter-count">{{ videoCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="post.media.length === 0" class="empty-state">
        <span class="empty-symbol"><Icon icon="mdi:image-multiple-outline" /></span>
        <h3>Добавьте моменты путешествия</h3>
        <p>Фото и видео можно собрать в галерею или распределить по таймлайну.</p>
        <KitBtn icon="mdi:plus" :disabled="isProcessing" @click="open()">
          Выбрать фото и видео
        </KitBtn>
      </div>

      <div v-else-if="!filteredMedia.length" class="no-results">
        <Icon icon="mdi:image-search-outline" />
        <div>
          <strong>Ничего не найдено</strong>
          <p>Измените запрос или выберите другой тип медиа.</p>
        </div>
        <KitBtn variant="text" color="secondary" size="sm" @click="clearMediaFilters">
          Сбросить фильтры
        </KitBtn>
      </div>

      <draggable
        v-else
        :list="displayedMedia"
        item-key="id"
        class="media-grid"
        handle=".drag-handle"
        :disabled="mode === 'select' || hasActiveMediaFilters"
        @end="store.isDirty = true"
      >
        <template #item="{ element: media }">
          <div
            class="media-card"
            :class="{
              'selected': localSelectedIds.includes(media.id) && (mode === 'select' || allowTimeline),
              'is-private': media.isPrivate,
              'is-filtered-out': !visibleMediaIds.has(media.id),
            }"
            @click="toggleSelection(media.id)"
          >
            <div v-if="mode === 'manage'" class="drag-handle" title="Перетащите, чтобы изменить порядок">
              <Icon icon="mdi:drag" />
            </div>

            <KitImage
              :src="getMediaThumbnail(media)"
              object-fit="cover"
              class="media-img"
            />

            <button
              v-if="media.type === 'video'"
              type="button"
              class="video-preview-btn"
              :aria-label="`Просмотреть видео ${media.originalName || ''}`"
              title="Просмотреть видео"
              @click.stop="openVideoPreview(media)"
            >
              <Icon icon="mdi:play" />
            </button>

            <button
              type="button"
              class="privacy-btn"
              :class="{ active: media.isPrivate }"
              :title="media.isPrivate ? 'Приватное (только для белого списка)' : 'Публичное медиа'"
              :aria-label="media.isPrivate ? 'Сделать медиа публичным' : 'Сделать медиа приватным'"
              :aria-pressed="media.isPrivate"
              @click.stop="togglePrivacy(media)"
            >
              <Icon :icon="media.isPrivate ? 'mdi:lock' : 'mdi:lock-open-variant-outline'" />
            </button>

            <button v-if="mode === 'select' || allowTimeline" type="button" class="selection-overlay" :aria-label="media.originalName || 'Выбрать медиа'" :aria-pressed="localSelectedIds.includes(media.id)" @click.stop="toggleSelection(media.id)">
              <div class="checkbox">
                <Icon v-if="localSelectedIds.includes(media.id)" icon="mdi:check" />
              </div>
            </button>

            <span class="media-caption" :title="media.originalName || (media.type === 'video' ? 'Видео' : 'Фото')">
              {{ getMediaCaptureDateTime(media) }}
            </span>
            <button type="button" class="delete-btn" :title="`Удалить ${media.originalName || 'медиа'}`" :aria-label="`Удалить ${media.originalName || 'медиа'}`" @click.stop="handleDelete(media.id)">
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </div>
        </template>
      </draggable>

      <div class="footer-actions">
        <KitBtn variant="text" color="secondary" :disabled="isProcessing" @click="emit('update:visible', false)">
          {{ mode === 'select' ? 'Отмена' : 'Закрыть' }}
        </KitBtn>
        <KitBtn
          v-if="allowTimeline && post.media.length"
          :variant="localSelectedIds.length ? 'solid' : 'text'"
          :color="localSelectedIds.length ? 'primary' : 'secondary'"
          :disabled="!localSelectedIds.length || isProcessing"
          icon="mdi:timeline-outline"
          @click="handleTimeline"
        >
          В таймлайн ({{ localSelectedIds.length }})
        </KitBtn>
        <KitBtn v-if="mode === 'select' && post.media.length" :disabled="localSelectedIds.length === 0" @click="handleConfirm">
          {{ single ? 'Выбрать' : `Выбрать (${localSelectedIds.length})` }}
        </KitBtn>
      </div>
    </div>

    <KitDialogWithClose
      :visible="isVideoPreviewOpen"
      :title="previewMedia?.originalName || 'Просмотр видео'"
      icon="mdi:video-outline"
      :max-width="1100"
      @update:visible="isVideoPreviewOpen = $event"
    >
      <div class="video-preview-content">
        <video
          v-if="isVideoPreviewOpen && videoPreviewUrl"
          :src="videoPreviewUrl"
          controls
          autoplay
          playsinline
          class="video-preview-player"
        />
      </div>
    </KitDialogWithClose>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
:global(.media-library-fullscreen-toggle) {
  flex: 0 0 auto;
  min-width: max-content;
  white-space: nowrap;
}

.library-container {
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 300px;
  height: min(62dvh, 580px);
  &.is-fullscreen {
    flex: 1 1 0;
    height: auto;
    min-height: 0;
  }
  &.is-empty {
    height: auto;
    min-height: 0;
  }
}
.processing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--bg-primary-color-rgb), 0.85);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg-primary-color);
  font-weight: 500;

  .spin {
    font-size: 3rem;
    color: var(--fg-accent-color);
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.media-toolbar {
  display: grid;
  grid-template-columns: max-content max-content minmax(180px, 1fr) max-content;
  align-items: center;
  gap: 10px 12px;
  width: 100%;
  max-width: 1480px;
  margin: 0 auto 14px;
}
.toolbar-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}
.stats {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px 10px;
  min-height: 38px;
  font-size: 13px;
  color: var(--fg-secondary-color);
  white-space: nowrap;

  strong {
    color: var(--fg-primary-color);
    font-weight: 600;
  }
}
.selected-summary {
  color: var(--fg-accent-color);
}
.media-search-wrap {
  min-width: 0;
}
.media-type-filters {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 4px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
}
.media-filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 10px;
  border: 0;
  border-radius: var(--r-s);
  background: transparent;
  color: var(--fg-secondary-color);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(.active) {
    color: var(--fg-primary-color);
  }

  &:focus-visible {
    outline: 2px solid var(--border-focus-color);
    outline-offset: 1px;
  }

  &.active {
    background: var(--bg-primary-color);
    color: var(--fg-primary-color);
    box-shadow: var(--s-s);
    font-weight: 600;
  }
}
.filter-count {
  color: var(--fg-tertiary-color);
  font-size: 11px;
}
.media-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 200px));
  grid-auto-rows: 190px;
  justify-content: center;
  align-content: start;
  gap: 12px;
  overflow-y: auto;
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
  padding: 2px;
}
.no-results {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  color: var(--fg-secondary-color);
  text-align: center;

  > svg {
    font-size: 28px;
    color: var(--fg-tertiary-color);
  }

  strong {
    color: var(--fg-primary-color);
  }

  p {
    margin: 4px 0 8px;
    font-size: 13px;
  }
}
.media-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  padding: 5px 8px;
  background: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  overflow: hidden;
  pointer-events: none;
}
.media-card {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--bg-tertiary-color);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &.is-filtered-out {
    display: none;
  }

  &.selected {
    border-color: var(--fg-accent-color);
    .selection-overlay {
      background: rgba(var(--fg-accent-color-rgb), 0.2);
      .checkbox {
        background: var(--fg-accent-color);
        border-color: var(--fg-accent-color);
        color: white;
      }
    }
  }

  &:hover,
  &:focus-within {
    .delete-btn,
    .privacy-btn,
    .drag-handle {
      opacity: 1;
    }

    transform: translateY(-2px);
    box-shadow: var(--s-s);
  }
}

.video-preview-btn {
  position: absolute;
  top: calc(50% - 20px);
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 50%;
  padding: 0;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 4;
  transition:
    background-color 0.2s,
    transform 0.2s;

  &:hover,
  &:focus-visible {
    background: var(--fg-accent-color);
    transform: translate(-50%, -50%) scale(1.08);
  }
}

.privacy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;

  &.active {
    background: var(--fg-warning-color, #f59e0b);
    color: #000;
  }

  @include hover {
    & {
      transform: scale(1.1);
    }
  }
}

.media-card.is-private {
  border: 2px solid var(--fg-warning-color, #f59e0b);

  .privacy-btn {
    opacity: 1;
  }
}

.drag-handle {
  position: absolute;
  top: 8px;
  left: calc(50% - 12px);
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.2s;

  &:active {
    cursor: grabbing;
  }
}

.media-img {
  width: 100%;
  height: calc(100% - 40px);
}

.selection-overlay {
  border: none;
  cursor: pointer;
  position: absolute;
  inset: 0 0 40px;
  background: transparent;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 8px;
  transition: all 0.2s;
}

.checkbox {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid white;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.delete-btn {
  position: absolute;
  bottom: 48px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: white;
  color: var(--fg-error-color);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;

  &:hover {
    background: var(--fg-error-color);
    color: white;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  min-height: 260px;
  padding: 28px 20px;
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  h3 {
    font-size: 17px;
    margin: 0;
  }
  p {
    max-width: 330px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--fg-secondary-color);
    margin: 0 0 4px;
  }
}

.video-preview-content {
  width: 100%;
  display: grid;
  place-items: center;
  min-height: 0;
}

.video-preview-player {
  display: block;
  width: 100%;
  max-height: min(72dvh, 720px);
  aspect-ratio: 16 / 9;
  background: #000;
  object-fit: contain;
}

:global(.media-library-dialog--fullscreen) {
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  max-height: none !important;
  padding: max(12px, var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))
    max(12px, var(--safe-area-inset-right, env(safe-area-inset-right, 0px)))
    max(12px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))
    max(12px, var(--safe-area-inset-left, env(safe-area-inset-left, 0px))) !important;
  border-radius: 0 !important;
  transform: translate(0, 0) !important;
}

:global(.media-library-dialog--fullscreen .dialog-body) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:global(.media-library-dialog--fullscreen .library-container.is-empty .empty-state) {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: transparent;
}

.empty-symbol {
  width: 52px;
  height: 52px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  border-radius: var(--r-m);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  font-size: 26px;
  margin-bottom: 4px;
}
.footer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);

  > button {
    font-size: 13px;
  }
}
@media (max-width: 980px) {
  .media-toolbar {
    grid-template-columns: minmax(0, 1fr) max-content;
  }
  .media-search-wrap {
    grid-column: 1;
  }
  .media-type-filters {
    grid-column: 2;
  }
}

@media (max-width: 640px) {
  .library-container {
    height: min(62dvh, 540px);
  }
  .media-toolbar {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
  .stats {
    flex-wrap: wrap;
    white-space: normal;
  }
  .toolbar-actions {
    grid-column: 1;
    width: 100%;
    justify-content: space-between;
  }
  .media-search-wrap {
    grid-column: 1;
    max-width: none;
  }
  .media-type-filters {
    grid-column: 1;
    width: 100%;
    justify-content: space-between;
  }
  .media-filter {
    flex: 1;
  }
  .media-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 170px;
    gap: 10px;
  }
  .footer-actions > button {
    flex: 1;
  }
  .empty-state {
    min-height: 250px;
    padding: 20px 12px;
  }
}

@media (max-width: 480px) {
  :global(.media-library-fullscreen-label) {
    display: none;
  }
}

@media (hover: none) {
  .media-card .privacy-btn,
  .media-card .delete-btn,
  .media-card .drag-handle {
    opacity: 1;
  }
}
</style>
