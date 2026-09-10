<script setup lang="ts">
import type { DocumentFile, DocumentFolder } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useToast } from '~/shared/composables/use-toast'
import { isTauri } from '~/shared/lib/env'
import { openExternalUrl } from '~/shared/lib/opener'
import { resolveApiUrl } from '~/shared/lib/url'
import { getCategoryMeta, getFileTypeInfo } from '../constants'

interface Props {
  document: DocumentFile
  readonly: boolean
  viewMode?: 'grid' | 'list'
  isSelected?: boolean
  isSelectionMode?: boolean
  folders?: DocumentFolder[]
}

const props = withDefaults(defineProps<Props>(), {
  viewMode: 'grid',
  isSelected: false,
  isSelectionMode: false,
  folders: () => [],
})

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update', value: DocumentFile): void
  (e: 'preview', doc: DocumentFile): void
  (e: 'edit', doc: DocumentFile): void
  (e: 'toggleSelect', id: string): void
  (e: 'move', id: string, targetFolderId: string | null): void
  (e: 'toggleFavorite', doc: DocumentFile): void
}>()

const toast = useToast()
const isDownloading = ref(false)

const extension = computed(() => {
  const urlExt = props.document.url.split('.').pop()?.toLowerCase() || ''
  return urlExt.split('?')[0]
})

const isImage = computed(() => {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(extension.value)
})

const fileTypeInfo = computed(() => {
  return getFileTypeInfo(extension.value)
})

const categoryMeta = computed(() => {
  return getCategoryMeta(props.document.category)
})

const displayName = computed(() => {
  if (props.document.title?.trim()) {
    return props.document.title.trim()
  }
  return props.document.originalName || 'Файл'
})

const secondaryName = computed(() => {
  if (props.document.title?.trim() && props.document.originalName !== props.document.title) {
    return props.document.originalName
  }
  return null
})

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0)
    return '0 Байт'
  const k = 1024
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateString: string | Date) {
  if (!dateString)
    return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

function toggleAccess() {
  if (props.readonly)
    return
  const newAccess = props.document.access === 'public' ? 'private' : 'public'
  emit('update', { ...props.document, access: newAccess })
  toast.info(newAccess === 'public' ? 'Файл стал публичным' : 'Файл доступен только участникам')
}

async function fetchFileBlob(absoluteUrl: string, rawUrl: string): Promise<Blob | null> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('trip-scheduler-offline-media')
      const match = await cache.match(absoluteUrl) || await cache.match(rawUrl)
      if (match) {
        return await match.blob()
      }
    }
    catch {
      // ignore
    }
  }

  try {
    const response = await fetch(absoluteUrl)
    if (response.ok) {
      return await response.blob()
    }
  }
  catch {
    // ignore
  }
  return null
}

async function handleDownload() {
  if (isDownloading.value)
    return
  isDownloading.value = true

  try {
    const absoluteUrl = resolveApiUrl(props.document.url)
    const blob = await fetchFileBlob(absoluteUrl, props.document.url)

    if (blob) {
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = props.document.originalName || displayName.value
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
      toast.success('Загрузка файла началась')
      return
    }

    if (isTauri) {
      await openExternalUrl(absoluteUrl)
      toast.info('Загрузка файла передана системе...')
      return
    }

    // fallback
    const link = document.createElement('a')
    link.href = absoluteUrl
    link.target = '_blank'
    link.download = props.document.originalName || displayName.value
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  catch (error) {
    console.error('Ошибка при скачивании:', error)
    toast.error('Не удалось скачать файл')
  }
  finally {
    isDownloading.value = false
  }
}

async function handleCopyLink() {
  const absoluteUrl = resolveApiUrl(props.document.url)
  try {
    await navigator.clipboard.writeText(absoluteUrl)
    toast.success('Ссылка на файл скопирована в буфер')
  }
  catch {
    toast.error('Не удалось скопировать ссылку')
  }
}

function handleCardClick() {
  if (props.isSelectionMode) {
    emit('toggleSelect', props.document.id)
  }
  else {
    emit('preview', props.document)
  }
}
</script>

<template>
  <!-- РЕЖИМ СЕТКИ (GRID) -->
  <div
    v-if="viewMode === 'grid'"
    class="doc-card"
    :class="{
      'is-selected': isSelected,
      'is-favorite': document.isFavorite,
      readonly,
    }"
    @click="handleCardClick"
  >
    <!-- Превью шапка -->
    <div class="card-preview-area" :style="!isImage ? { backgroundColor: fileTypeInfo.bgColor } : {}">
      <!-- Реальная картинка -->
      <img
        v-if="isImage"
        v-resolve-src="document.url"
        :alt="displayName"
        class="img-preview"
      >
      <!-- Иконка типа файла -->
      <div v-else class="icon-preview-box" :style="{ color: fileTypeInfo.color }">
        <Icon :icon="fileTypeInfo.icon" width="48" height="48" />
        <span class="file-ext-label">{{ extension.toUpperCase() }}</span>
      </div>

      <!-- Чекбокс выбора -->
      <div
        v-if="!readonly"
        class="card-select-box"
        :class="{ 'is-visible': isSelectionMode || isSelected }"
        @click.stop="emit('toggleSelect', document.id)"
      >
        <div class="custom-checkbox" :class="{ 'is-checked': isSelected }">
          <Icon v-if="isSelected" icon="mdi:check" width="14" height="14" />
        </div>
      </div>

      <!-- Звездочка Избранного -->
      <button
        v-if="!readonly"
        type="button"
        class="star-badge"
        :class="{ 'is-active': document.isFavorite }"
        :title="document.isFavorite ? 'Убрать из важного' : 'Добавить в важное'"
        @click.stop="emit('toggleFavorite', document)"
      >
        <Icon :icon="document.isFavorite ? 'mdi:star' : 'mdi:star-outline'" width="18" height="18" />
      </button>
    </div>

    <!-- Контент карточки -->
    <div class="card-body">
      <!-- Категория и доступ -->
      <div class="card-tags-row">
        <span
          v-if="categoryMeta"
          class="cat-badge"
          :style="{ color: categoryMeta.color, backgroundColor: `${categoryMeta.color}15`, borderColor: `${categoryMeta.color}30` }"
        >
          <Icon :icon="categoryMeta.icon" width="13" height="13" />
          <span>{{ categoryMeta.label }}</span>
        </span>

        <span
          class="access-chip"
          :class="`access--${document.access}`"
          :title="document.access === 'public' ? 'Публичный доступ (виден всем)' : 'Приватный (только для участников)'"
          @click.stop="toggleAccess"
        >
          <Icon :icon="document.access === 'public' ? 'mdi:earth' : 'mdi:lock-outline'" width="13" height="13" />
        </span>
      </div>

      <!-- Название документа -->
      <div class="card-title-box">
        <KitTooltip :text="displayName">
          <span class="card-title">{{ displayName }}</span>
        </KitTooltip>
        <KitTooltip v-if="secondaryName" :text="secondaryName">
          <span class="card-subtitle">{{ secondaryName }}</span>
        </KitTooltip>
      </div>

      <!-- Заметка, если есть -->
      <div v-if="document.note" class="card-note-box">
        <Icon icon="mdi:note-text-outline" width="14" height="14" class="note-icon" />
        <span class="card-note-text" :title="document.note">{{ document.note }}</span>
      </div>

      <!-- Подвал карточки -->
      <div class="card-footer">
        <div class="card-meta">
          <span>{{ formatBytes(document.sizeBytes) }}</span>
          <span class="dot">•</span>
          <span>{{ formatDate(document.createdAt) }}</span>
        </div>

        <div class="card-actions" @click.stop>
          <KitTooltip text="Скачать">
            <button class="footer-btn" :disabled="isDownloading" @click="handleDownload">
              <Icon :icon="isDownloading ? 'mdi:loading' : 'mdi:download-outline'" :class="{ spin: isDownloading }" width="17" height="17" />
            </button>
          </KitTooltip>

          <!-- Меню действий -->
          <KitDropdown v-if="!readonly" align="end" :items="[]">
            <template #trigger>
              <button class="footer-btn">
                <Icon icon="mdi:dots-vertical" width="17" height="17" />
              </button>
            </template>
            <div class="dropdown-menu">
              <button class="menu-item" @click="emit('preview', document)">
                <Icon icon="mdi:file-eye-outline" />
                <span>Просмотреть</span>
              </button>

              <button class="menu-item" @click="emit('edit', document)">
                <Icon icon="mdi:pencil-outline" />
                <span>Свойства и заметка</span>
              </button>

              <button class="menu-item" @click="emit('toggleFavorite', document)">
                <Icon :icon="document.isFavorite ? 'mdi:star-off-outline' : 'mdi:star-outline'" />
                <span>{{ document.isFavorite ? 'Убрать из важного' : 'Добавить в важное' }}</span>
              </button>

              <button class="menu-item" @click="handleCopyLink">
                <Icon icon="mdi:link-variant" />
                <span>Скопировать ссылку</span>
              </button>

              <button class="menu-item" @click="toggleAccess">
                <Icon :icon="document.access === 'public' ? 'mdi:lock-outline' : 'mdi:earth'" />
                <span>{{ document.access === 'public' ? 'Сделать приватным' : 'Сделать публичным' }}</span>
              </button>

              <!-- Меню папок -->
              <div v-if="folders.length > 0" class="menu-divider" />
              <div v-if="folders.length > 0" class="menu-section-header">
                Переместить:
              </div>

              <button
                v-if="document.folderId !== null"
                class="menu-item sub-item"
                @click="emit('move', document.id, null)"
              >
                <Icon icon="mdi:folder-home-outline" />
                <span>Все документы</span>
              </button>

              <template v-for="f in folders" :key="f.id">
                <button
                  v-if="document.folderId !== f.id"
                  class="menu-item sub-item"
                  @click="emit('move', document.id, f.id)"
                >
                  <Icon icon="mdi:folder-outline" />
                  <span>{{ f.name }}</span>
                </button>
              </template>

              <div class="menu-divider" />
              <button class="menu-item menu-item--danger" @click="emit('delete')">
                <Icon icon="mdi:trash-can-outline" />
                <span>Удалить</span>
              </button>
            </div>
          </KitDropdown>
        </div>
      </div>
    </div>
  </div>

  <!-- РЕЖИМ СПИСКА (LIST) -->
  <div
    v-else
    class="doc-row"
    :class="{
      'is-selected': isSelected,
      'is-favorite': document.isFavorite,
      readonly,
    }"
    @click="handleCardClick"
  >
    <!-- Чекбокс выбора -->
    <div
      v-if="!readonly"
      class="row-checkbox-box"
      @click.stop="emit('toggleSelect', document.id)"
    >
      <div class="custom-checkbox" :class="{ 'is-checked': isSelected }">
        <Icon v-if="isSelected" icon="mdi:check" width="13" height="13" />
      </div>
    </div>

    <!-- Иконка или мини-превью -->
    <div class="row-icon-box" :style="{ backgroundColor: fileTypeInfo.bgColor, color: fileTypeInfo.color }">
      <img v-if="isImage" v-resolve-src="document.url" :alt="displayName" class="row-img-thumb">
      <Icon v-else :icon="fileTypeInfo.icon" width="22" height="22" />
    </div>

    <!-- Название и заметка -->
    <div class="row-title-area">
      <div class="row-title-line">
        <span class="row-main-title">{{ displayName }}</span>
        <span v-if="secondaryName" class="row-secondary-name">({{ secondaryName }})</span>
      </div>
      <span v-if="document.note" class="row-note-text">
        <Icon icon="mdi:note-text-outline" width="13" height="13" />
        {{ document.note }}
      </span>
    </div>

    <!-- Категория -->
    <div class="row-category-area">
      <span
        v-if="categoryMeta"
        class="cat-badge"
        :style="{ color: categoryMeta.color, backgroundColor: `${categoryMeta.color}15`, borderColor: `${categoryMeta.color}30` }"
      >
        <Icon :icon="categoryMeta.icon" width="13" height="13" />
        <span>{{ categoryMeta.label }}</span>
      </span>
    </div>

    <!-- Метаданные (размер и дата) -->
    <div class="row-meta-area">
      <span class="meta-size">{{ formatBytes(document.sizeBytes) }}</span>
      <span class="meta-date">{{ formatDate(document.createdAt) }}</span>
    </div>

    <!-- Доступ -->
    <div class="row-access-area">
      <button
        class="access-chip"
        :class="`access--${document.access}`"
        :disabled="readonly"
        :title="document.access === 'public' ? 'Публичный' : 'Приватный'"
        @click.stop="toggleAccess"
      >
        <Icon :icon="document.access === 'public' ? 'mdi:earth' : 'mdi:lock-outline'" width="14" height="14" />
      </button>
    </div>

    <!-- Звездочка -->
    <div v-if="!readonly" class="row-star-area">
      <button
        type="button"
        class="star-badge"
        :class="{ 'is-active': document.isFavorite }"
        :title="document.isFavorite ? 'Убрать из важного' : 'Добавить в важное'"
        @click.stop="emit('toggleFavorite', document)"
      >
        <Icon :icon="document.isFavorite ? 'mdi:star' : 'mdi:star-outline'" width="18" height="18" />
      </button>
    </div>

    <!-- Действия -->
    <div class="row-actions-area" @click.stop>
      <KitTooltip text="Скачать">
        <button class="footer-btn" :disabled="isDownloading" @click="handleDownload">
          <Icon :icon="isDownloading ? 'mdi:loading' : 'mdi:download-outline'" :class="{ spin: isDownloading }" width="17" height="17" />
        </button>
      </KitTooltip>

      <KitDropdown v-if="!readonly" align="end" :items="[]">
        <template #trigger>
          <button class="footer-btn">
            <Icon icon="mdi:dots-vertical" width="17" height="17" />
          </button>
        </template>
        <div class="dropdown-menu">
          <button class="menu-item" @click="emit('preview', document)">
            <Icon icon="mdi:file-eye-outline" />
            <span>Просмотреть</span>
          </button>
          <button class="menu-item" @click="emit('edit', document)">
            <Icon icon="mdi:pencil-outline" />
            <span>Свойства и заметка</span>
          </button>
          <button class="menu-item" @click="handleCopyLink">
            <Icon icon="mdi:link-variant" />
            <span>Скопировать ссылку</span>
          </button>
          <button class="menu-item" @click="toggleAccess">
            <Icon :icon="document.access === 'public' ? 'mdi:lock-outline' : 'mdi:earth'" />
            <span>{{ document.access === 'public' ? 'Сделать приватным' : 'Сделать публичным' }}</span>
          </button>

          <div v-if="folders.length > 0" class="menu-divider" />
          <div v-if="folders.length > 0" class="menu-section-header">
            Переместить:
          </div>
          <button
            v-if="document.folderId !== null"
            class="menu-item sub-item"
            @click="emit('move', document.id, null)"
          >
            <Icon icon="mdi:folder-home-outline" />
            <span>Все документы</span>
          </button>
          <template v-for="f in folders" :key="f.id">
            <button
              v-if="document.folderId !== f.id"
              class="menu-item sub-item"
              @click="emit('move', document.id, f.id)"
            >
              <Icon icon="mdi:folder-outline" />
              <span>{{ f.name }}</span>
            </button>
          </template>

          <div class="menu-divider" />
          <button class="menu-item menu-item--danger" @click="emit('delete')">
            <Icon icon="mdi:trash-can-outline" />
            <span>Удалить</span>
          </button>
        </div>
      </KitDropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Общий кастомный чекбокс */
.custom-checkbox {
  width: 18px;
  height: 18px;
  border-radius: var(--r-xs);
  border: 1.5px solid var(--border-primary-color);
  background-color: var(--bg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &.is-checked {
    background-color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: white;
  }
}

/* Звездочка Избранного */
.star-badge {
  background: transparent;
  border: none;
  color: var(--fg-tertiary-color);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--r-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    color: #f59e0b;
    transform: scale(1.15);
  }

  &.is-active {
    color: #f59e0b;
  }
}

/* Бейджи доступа и категорий */
.access-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
  border-radius: var(--r-xs);
  border: 1px solid var(--border-secondary-color);
  background: transparent;
  color: var(--fg-tertiary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    color: var(--fg-primary-color);
  }

  &.access--public {
    color: var(--fg-success-color);
    border-color: var(--border-success-color);
    background-color: rgba(var(--fg-success-color-rgb), 0.1);
  }
}

.cat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--r-xs);
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}

/* Кнопка в футере */
.footer-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--r-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

/* ==================== РЕЖИМ СЕТКИ (GRID) ==================== */
.doc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;

  &:hover:not(.readonly) {
    border-color: var(--border-primary-color);
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);

    .card-select-box {
      opacity: 1;
      visibility: visible;
    }
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }

  &.is-favorite {
    border-left: 3px solid #f59e0b;
  }
}

.card-preview-area {
  position: relative;
  width: 100%;
  height: 125px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: var(--bg-tertiary-color);

  .img-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  &:hover .img-preview {
    transform: scale(1.05);
  }

  .icon-preview-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    .file-ext-label {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      opacity: 0.9;
    }
  }

  .card-select-box {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s;

    &.is-visible {
      opacity: 1;
      visibility: visible;
    }
  }

  .star-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
    background-color: rgba(var(--bg-primary-color-rgb), 0.75);
    backdrop-filter: blur(4px);
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
  flex-grow: 1;
}

.card-tags-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 22px;
}

.card-title-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .card-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .card-subtitle {
    font-size: 0.78rem;
    color: var(--fg-tertiary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-note-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--r-xs);
  background-color: var(--bg-primary-color);
  border: 1px dashed var(--border-secondary-color);
  font-size: 0.8rem;
  color: var(--fg-secondary-color);

  .note-icon {
    flex-shrink: 0;
    color: var(--fg-accent-color);
  }

  .card-note-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--border-secondary-color);

  .card-meta {
    font-size: 0.78rem;
    color: var(--fg-tertiary-color);
    display: flex;
    align-items: center;
    gap: 4px;

    .dot {
      opacity: 0.5;
    }
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}

/* ==================== РЕЖИМ СПИСКА (LIST) ==================== */
.doc-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto auto auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.readonly) {
    background-color: var(--bg-hover-color);
    border-color: var(--border-primary-color);
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--fg-accent-color-rgb), 0.05);
  }

  &.is-favorite {
    border-left: 3px solid #f59e0b;
  }

  @media (max-width: 768px) {
    grid-template-columns: auto auto 1fr auto auto;
    .row-category-area,
    .row-access-area {
      display: none;
    }
  }
}

.row-icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--r-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  .row-img-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.row-title-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;

  .row-title-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;

    .row-main-title {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-secondary-name {
      font-size: 0.8rem;
      color: var(--fg-tertiary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .row-note-text {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.row-meta-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 0.78rem;
  color: var(--fg-tertiary-color);
  white-space: nowrap;
}

.row-actions-area {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* ==================== ВЫПАДАЮЩЕЕ МЕНЮ ==================== */
.dropdown-menu {
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 190px;
}

.menu-section-header {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-tertiary-color);
  padding: 4px 10px 2px;
}

.menu-divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-xs);
  font-size: 0.88rem;
  color: var(--fg-primary-color);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &.sub-item {
    padding-left: 20px;
    font-size: 0.83rem;
  }

  &--danger {
    color: var(--fg-error-color);
    &:hover {
      background-color: rgba(var(--fg-error-color-rgb), 0.1);
    }
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
