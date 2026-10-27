<script setup lang="ts">
import type { PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useFileDialog } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
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
    :max-width="900"
    :persistent="isProcessing"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="library-container" :class="{ 'is-empty': !post.media.length }">
      <div v-if="isProcessing" class="processing-overlay">
        <Icon icon="mdi:loading" class="spin" />
        <p>Загрузка медиафайлов ({{ processedCount }} / {{ totalToProcess }})...</p>
      </div>

      <div v-if="post.media.length" class="toolbar">
        <div class="stats">
          Файлы: {{ post.media.length }}<span v-if="localSelectedIds.length"> · Выбрано: {{ localSelectedIds.length }}</span>
        </div>
        <div class="toolbar-actions">
          <KitBtn variant="tonal" icon="mdi:plus" :disabled="isProcessing" @click="open()">
            Добавить медиа
          </KitBtn>

          <KitBtn v-if="!single && (mode === 'select' || allowTimeline)" variant="text" :disabled="isProcessing" @click="localSelectedIds = localSelectedIds.length === post.media.length ? [] : post.media.map(media => media.id)">
            {{ localSelectedIds.length === post.media.length && post.media.length ? 'Снять выбор' : 'Выбрать все' }}
          </KitBtn>
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

      <draggable
        v-else
        v-model="post.media"
        item-key="id"
        class="media-grid"
        handle=".drag-handle"
        :disabled="mode === 'select'"
        @end="store.isDirty = true"
      >
        <template #item="{ element: media }">
          <div
            class="media-card"
            :title="media.originalName"
            :class="{ 'selected': localSelectedIds.includes(media.id) && (mode === 'select' || allowTimeline), 'is-private': media.isPrivate }"
            @click="toggleSelection(media.id)"
          >
            <div v-if="mode === 'manage'" class="drag-handle">
              <Icon icon="mdi:drag" />
            </div>

            <KitImage
              :src="getMediaThumbnail(media)"
              object-fit="cover"
              class="media-img"
            />

            <div v-if="media.type === 'video'" class="video-badge" title="Видео">
              <Icon icon="mdi:play-circle" />
            </div>

            <button
              class="privacy-btn"
              :class="{ active: media.isPrivate }"
              :title="media.isPrivate ? 'Приватное (только для белого списка)' : 'Публичное медиа'"
              @click.stop="togglePrivacy(media)"
            >
              <Icon :icon="media.isPrivate ? 'mdi:lock' : 'mdi:lock-open-variant-outline'" />
            </button>

            <button v-if="mode === 'select' || allowTimeline" type="button" class="selection-overlay" :aria-label="media.originalName || 'Выбрать медиа'" :aria-pressed="localSelectedIds.includes(media.id)" @click.stop="toggleSelection(media.id)">
              <div class="checkbox">
                <Icon v-if="localSelectedIds.includes(media.id)" icon="mdi:check" />
              </div>
            </button>

            <span class="media-caption">{{ media.originalName || (media.type === 'video' ? 'Видео' : 'Фото') }}</span>
            <button class="delete-btn" :aria-label="`Удалить ${media.originalName || 'медиа'}`" @click.stop="handleDelete(media.id)">
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </div>
        </template>
      </draggable>

      <p class="library-hint">
        <Icon icon="mdi:cloud-check-outline" /><span>Медиа сохраняются в черновике и удаляются вместе с постом.</span>
      </p>
      <div class="footer-actions">
        <KitBtn variant="text" color="secondary" :disabled="isProcessing" @click="emit('update:visible', false)">
          {{ mode === 'select' ? 'Отмена' : 'Закрыть' }}
        </KitBtn>
        <KitBtn v-if="allowTimeline && post.media.length" :disabled="!localSelectedIds.length || isProcessing" icon="mdi:timeline-outline" @click="handleTimeline">
          В таймлайн ({{ localSelectedIds.length }})
        </KitBtn>
        <KitBtn v-if="mode === 'select' && post.media.length" :disabled="localSelectedIds.length === 0" @click="handleConfirm">
          {{ single ? 'Выбрать' : `Выбрать (${localSelectedIds.length})` }}
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.library-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--fg-secondary-color);
  margin: 16px 0 0;
  > svg {
    margin-top: 2px;
    flex-shrink: 0;
    font-size: 16px;
  }
}
.library-container {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 300px;
  height: min(62dvh, 580px);
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

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
}
.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  > button {
    font-size: 12px;
    padding: 8px 10px;
  }
}
.stats {
  font-size: 13px;
  color: var(--fg-secondary-color);
}
.media-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  grid-auto-rows: 180px;
  align-content: start;
  gap: 12px;
  overflow-y: auto;
  padding: 2px;
}
.media-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  display: block;
  padding: 7px 8px;
  background: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  transition: all 0.2s;

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
    .drag-handle {
      opacity: 1;
    }
  }
}

.video-badge {
  position: absolute;
  top: 8px;
  left: calc(50% - 12px);
  background: rgba(0, 0, 0, 0.65);
  color: white;
  border-radius: 6px;
  padding: 4px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
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
  transition: all 0.2s ease;

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
  height: calc(100% - 30px);
}

.selection-overlay {
  border: none;
  cursor: pointer;
  position: absolute;
  inset: 0 0 30px;
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
  bottom: 38px;
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
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
  margin-top: 16px;
  > button {
    font-size: 13px;
  }
}
@media (max-width: 640px) {
  .library-container {
    height: min(62dvh, 540px);
  }
  .toolbar {
    gap: 10px;
  }
  .toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }
  .media-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 180px;
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
</style>
