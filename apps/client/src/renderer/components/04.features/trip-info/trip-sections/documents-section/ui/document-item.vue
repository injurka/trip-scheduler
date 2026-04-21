<script setup lang="ts">
import type { DocumentFile } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { useToast } from '~/shared/composables/use-toast'
import { resolveApiUrl } from '~/shared/lib/url'

const props = defineProps<{
  document: DocumentFile
  readonly: boolean
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update', value: DocumentFile): void
}>()

const toast = useToast()
const isDownloading = ref(false)

const extension = computed(() => {
  const urlExt = props.document.url.split('.').pop()?.toLowerCase() || ''
  return urlExt.split('?')[0]
})

const displayName = computed(() => {
  const name = props.document.originalName || 'Файл'
  if (!name.toLowerCase().endsWith(`.${extension.value}`) && extension.value) {
    return `${name}.${extension.value}`
  }
  return name
})

const isImage = computed(() => {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(extension.value)
})

function getFileIcon(ext: string) {
  if (['pdf'].includes(ext))
    return 'mdi:file-pdf-box'
  if (['doc', 'docx'].includes(ext))
    return 'mdi:file-word-outline'
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return 'mdi:file-excel-outline'
  if (['zip', 'rar', '7z'].includes(ext))
    return 'mdi:zip-box-outline'
  if (['txt', 'md'].includes(ext))
    return 'mdi:file-document-outline'
  return 'mdi:file-outline'
}

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0)
    return '0 Байт'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

function formatDate(dateString: string | Date) {
  if (!dateString)
    return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function toggleAccess() {
  if (props.readonly)
    return
  const newAccess = props.document.access === 'public' ? 'private' : 'public'
  emit('update', { ...props.document, access: newAccess })
}

async function handleDownload() {
  if (isDownloading.value)
    return
  isDownloading.value = true

  try {
    const absoluteUrl = resolveApiUrl(props.document.url)
    const response = await fetch(absoluteUrl)

    if (!response.ok) {
      throw new Error('Не удалось скачать файл')
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = displayName.value
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }
  catch (error) {
    console.error('Ошибка при скачивании:', error)
    toast.error('Не удалось скачать файл')
  }
  finally {
    isDownloading.value = false
  }
}

function handleOpen() {
  const absoluteUrl = resolveApiUrl(props.document.url)
  window.open(absoluteUrl, '_blank')
}
</script>

<template>
  <div class="document-item" :class="{ readonly }" @click="handleOpen">
    <div class="doc-icon">
      <img v-if="isImage" v-resolve-src="document.url" :alt="displayName" class="doc-preview">
      <Icon v-else :icon="getFileIcon(extension)" />
    </div>

    <div class="doc-info">
      <span class="doc-name" :title="displayName">{{ displayName }}</span>
      <span class="doc-meta">{{ formatBytes(document.sizeBytes) }} • {{ formatDate(document.createdAt) }}</span>
    </div>

    <div class="doc-actions">
      <button
        class="access-badge"
        :class="`access--${document.access}`"
        :title="document.access === 'public' ? 'Публичный доступ' : 'Только для участников'"
        :disabled="readonly"
        @click.stop="toggleAccess"
      >
        <Icon :icon="document.access === 'public' ? 'mdi:earth' : 'mdi:lock-outline'" />
      </button>

      <KitDropdown v-if="!readonly" align="end" :items="[]">
        <template #trigger>
          <button class="action-btn" @click.stop>
            <Icon icon="mdi:dots-vertical" />
          </button>
        </template>
        <div class="dropdown-menu">
          <button class="menu-item" @click.stop="handleOpen">
            <Icon icon="mdi:open-in-new" />
            <span>Открыть</span>
          </button>
          <button class="menu-item" :disabled="isDownloading" @click.stop="handleDownload">
            <Icon :icon="isDownloading ? 'mdi:loading' : 'mdi:download-outline'" :class="{ spin: isDownloading }" />
            <span>{{ isDownloading ? 'Скачивание...' : 'Скачать' }}</span>
          </button>
          <button class="menu-item menu-item--danger" @click.stop="emit('delete')">
            <Icon icon="mdi:trash-can-outline" />
            <span>Удалить</span>
          </button>
        </div>
      </KitDropdown>

      <button v-else class="action-btn" title="Скачать" :disabled="isDownloading" @click.stop="handleDownload">
        <Icon :icon="isDownloading ? 'mdi:loading' : 'mdi:download-outline'" :class="{ spin: isDownloading }" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.document-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--r-m);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s;
  cursor: pointer;
  margin-bottom: 8px;

  &:hover:not(.readonly) {
    background-color: var(--bg-hover-color);
    border-color: var(--border-primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
}

.doc-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-s);
  font-size: 1.5rem;
  color: var(--fg-secondary-color);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);

  .doc-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.doc-info {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.doc-name {
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fg-primary-color);
}

.doc-meta {
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
}

.doc-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.access-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid;
  background: transparent;

  &.access--public {
    color: var(--fg-success-color);
    border-color: var(--border-success-color);
    background-color: rgba(var(--fg-success-color-rgb), 0.1);
  }

  &.access--private {
    color: var(--fg-secondary-color);
    border-color: var(--border-secondary-color);
  }

  &:not(:disabled) {
    cursor: pointer;
    &:hover {
      transform: scale(1.05);
    }
  }
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.dropdown-menu {
  display: flex;
  flex-direction: column;
  padding: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-xs);
  font-size: 0.9rem;
  text-align: left;
  width: 100%;
  transition: background-color 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--fg-primary-color);

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--danger {
    color: var(--fg-error-color);
    &:hover:not(:disabled) {
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
