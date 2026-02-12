<script setup lang="ts">
import type { DocumentFile } from '../models/types'
import { Icon } from '@iconify/vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

const props = defineProps<{
  document: DocumentFile
  readonly: boolean
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'update', value: DocumentFile): void
}>()

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type))
    return 'mdi:file-image-outline'
  if (['pdf'].includes(type))
    return 'mdi:file-pdf-box'
  if (['doc', 'docx'].includes(type))
    return 'mdi:file-word-outline'
  if (['xls', 'xlsx'].includes(type))
    return 'mdi:file-excel-outline'
  if (['zip', 'rar', '7z'].includes(type))
    return 'mdi:zip-box-outline'
  if (['txt', 'md'].includes(type))
    return 'mdi:file-document-outline'
  return 'mdi:file-outline'
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0)
    return '0 Байт'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

function toggleAccess() {
  if (props.readonly)
    return
  const newAccess = props.document.access === 'public' ? 'private' : 'public'
  emit('update', { ...props.document, access: newAccess })
}

function handleDownload() {
  // TODO
}
</script>

<template>
  <div class="document-item" :class="{ readonly }">
    <div class="doc-icon">
      <Icon :icon="getFileIcon(document.fileType)" />
    </div>
    <div class="doc-info">
      <span class="doc-name">{{ document.name }}</span>
      <span class="doc-meta">{{ formatBytes(document.sizeBytes) }} • {{ formatDate(document.createdAt, { dateStyle: 'medium' }) }}</span>
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
          <button class="menu-item" @click="handleDownload">
            <Icon icon="mdi:download-outline" />
            <span>Скачать</span>
          </button>
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
.document-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--r-m);
  transition: background-color 0.2s;

  &:hover:not(.readonly) {
    background-color: var(--bg-hover-color);
  }
}

.doc-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  font-size: 1.5rem;
  color: var(--fg-secondary-color);
}

.doc-info {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.doc-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-meta {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

.doc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.access-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: var(--r-full);
  border: 1px solid;
  font-weight: 500;

  &.access--public {
    color: var(--fg-success-color);
    border-color: var(--border-success-color);
  }

  &.access--private {
    color: var(--fg-secondary-color);
    border-color: var(--border-secondary-color);
  }

  &:not(:disabled) {
    cursor: pointer;
    &:hover {
      opacity: 0.8;
    }
  }
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-tertiary-color);
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
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-xs);
  font-size: 0.9rem;
  text-align: left;
  width: 100%;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &--danger:hover {
    color: var(--fg-error-color);
  }
}
</style>
