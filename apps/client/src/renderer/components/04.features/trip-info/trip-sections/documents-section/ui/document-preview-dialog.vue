<script setup lang="ts">
import type { DocumentFile } from '../models/types'
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { useToast } from '~/shared/composables/use-toast'
import { isTauri } from '~/shared/lib/env'
import { openExternalUrl } from '~/shared/lib/opener'
import { resolveApiUrl, stripAuthTokenFromUrl } from '~/shared/lib/url'
import { formatBytes, getFileTypeInfo } from '../constants'
import DocumentPdfViewer from './document-pdf-viewer.vue'

interface Props {
  visible: boolean
  document: DocumentFile | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'download', doc: DocumentFile): void
}>()

const toast = useToast()
const isTextLoading = ref(false)
const textContent = ref<string | null>(null)

const extension = computed(() => {
  if (!props.document)
    return ''

  return props.document.url.split('.').pop()?.toLowerCase().split('?')[0] || ''
})

const fileTypeInfo = computed(() => {
  return getFileTypeInfo(extension.value)
})

const absoluteUrl = computed(() => {
  if (!props.document)
    return ''

  return resolveApiUrl(props.document.url)
})

const isPdf = computed(() => extension.value === 'pdf')
const isText = computed(() => ['txt', 'md', 'json', 'csv'].includes(extension.value))

const dropdownActions = computed<KitDropdownItem<string>[]>(() => {
  return [
    {
      label: isTauri ? 'Открыть в приложении' : 'В новой вкладке',
      value: 'openExternal',
      icon: 'mdi:open-in-new',
    },
    {
      label: 'Скачать',
      value: 'download',
      icon: 'mdi:download-outline',
    },
    {
      label: 'Скопировать ссылку',
      value: 'copyLink',
      icon: 'mdi:link-variant',
    },
  ]
})

watch(() => props.document, async (doc) => {
  textContent.value = null

  if (doc && isText.value)
    await loadDocumentText(doc)
}, { immediate: true })

async function findCachedResponse(url: string): Promise<Response | null> {
  if (typeof caches === 'undefined')
    return null

  const urlWithoutToken = stripAuthTokenFromUrl(url)

  try {
    const cache = await caches.open('trip-scheduler-offline-media')

    return await cache.match(url)
      || (urlWithoutToken ? await cache.match(urlWithoutToken) : null)
      || null
  }
  catch {
    return null
  }
}

async function loadTextContent(url: string): Promise<string | null> {
  const cached = await findCachedResponse(url)

  if (cached) {
    try {
      return await cached.text()
    }
    catch {
      // Ignore stale cache entries and fall back to the network.
    }
  }

  const response = await fetch(url)

  return response.ok ? response.text() : null
}

async function loadDocumentText(doc: DocumentFile) {
  isTextLoading.value = true

  try {
    textContent.value = await loadTextContent(resolveApiUrl(doc.url))
  }
  catch (error) {
    console.warn('Failed to load text content:', error)
  }
  finally {
    isTextLoading.value = false
  }
}

function handleOpenExternal() {
  if (absoluteUrl.value) {
    openExternalUrl(absoluteUrl.value)
  }
}

async function handleDownload() {
  if (!props.document)
    return

  emit('download', props.document)

  try {
    const doc = props.document
    const url = resolveApiUrl(doc.url)
    const blob = await loadDocumentBlob(url)

    if (blob) {
      downloadBlob(blob, doc)

      return
    }

    if (isTauri)
      await openSystemDownload(url)
    else
      openBrowserDownload(url, doc)
  }
  catch (error) {
    console.error('Ошибка при скачивании:', error)
    toast.error('Не удалось скачать файл')
  }
}

async function loadDocumentBlob(url: string): Promise<Blob | null> {
  const cached = await findCachedResponse(url)

  if (cached)
    return cached.blob()

  try {
    const response = await fetch(url)

    return response.ok ? response.blob() : null
  }
  catch {
    return null
  }
}

function downloadBlob(blob: Blob, doc: DocumentFile) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = doc.originalName || doc.title || 'document'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
  toast.success('Загрузка файла началась')
}

async function openSystemDownload(url: string) {
  await openExternalUrl(url)
  toast.info('Загрузка файла передана системе...')
}

function openBrowserDownload(url: string, doc: DocumentFile) {
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.download = doc.originalName || doc.title || 'document'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  toast.success('Загрузка файла началась')
}

async function handleCopyLink() {
  if (!absoluteUrl.value)
    return

  try {
    await navigator.clipboard.writeText(absoluteUrl.value)
    toast.success('Ссылка на файл скопирована в буфер')
  }
  catch {
    toast.error('Не удалось скопировать ссылку')
  }
}

function handleActionSelect(action: string) {
  if (action === 'openExternal') {
    handleOpenExternal()
  }
  else if (action === 'download') {
    handleDownload()
  }
  else if (action === 'copyLink') {
    handleCopyLink()
  }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Просмотр документа"
    icon="mdi:file-eye-outline"
    :max-width="isPdf ? 900 : 540"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="document" class="preview-container">
      <!-- Панель метаданных в шапке модалки -->
      <div class="preview-topbar">
        <div class="file-badges">
          <span class="type-badge" :style="{ backgroundColor: fileTypeInfo.bgColor, color: fileTypeInfo.color }">
            <Icon :icon="fileTypeInfo.icon" width="16" height="16" />
            <span>{{ fileTypeInfo.label }}</span>
          </span>
          <span class="privacy-badge" :class="`privacy--${document.access}`">
            <Icon :icon="document.access === 'public' ? 'mdi:earth' : 'mdi:lock-outline'" width="14" height="14" />
            <span>{{ document.access === 'public' ? 'Публичный' : 'Приватный' }}</span>
          </span>
          <span class="size-badge">
            {{ formatBytes(document.sizeBytes) }}
          </span>
        </div>

        <!-- Меню действий в шапке -->
        <div class="topbar-actions">
          <KitDropdown
            align="end"
            :items="dropdownActions"
            @update:model-value="handleActionSelect"
          >
            <template #trigger>
              <button class="topbar-more-btn" title="Действия с файлом">
                <Icon icon="mdi:dots-vertical" width="16" height="16" />
              </button>
            </template>
          </KitDropdown>
        </div>
      </div>

      <!-- Имя файла для PDF / Текста -->
      <div v-if="isPdf || isText" class="preview-doc-title" :title="document.title || document.originalName">
        {{ document.title || document.originalName }}
      </div>

      <!-- Встроенный PDF Viewer (pdfjs-dist) -->
      <DocumentPdfViewer
        v-if="isPdf"
        :url="document.url"
        :title="document.title || document.originalName"
      />

      <!-- Текстовый файл -->
      <div v-else-if="isText" class="text-wrapper">
        <div v-if="isTextLoading" class="loading-state">
          <Icon icon="mdi:loading" class="spin" />
          <span>Загрузка содержимого...</span>
        </div>
        <pre v-else class="text-content">{{ textContent }}</pre>
      </div>

      <!-- Файлы без встроенного просмотра (Word, Excel, ZIP, Torrent и т.д.) -->
      <div v-else class="unsupported-preview">
        <div class="large-icon-box" :style="{ backgroundColor: fileTypeInfo.bgColor, color: fileTypeInfo.color }">
          <Icon :icon="fileTypeInfo.icon" width="56" height="56" />
        </div>
        <h3 class="preview-filename" :title="document.title || document.originalName">
          {{ document.title || document.originalName }}
        </h3>
        <p class="preview-desc">
          Встроенный просмотр для этого типа файлов недоступен. Вы можете открыть его в стороннем приложении или скачать на устройство.
        </p>
        <div class="actions-row">
          <KitBtn icon="mdi:open-in-new" variant="outlined" @click="handleOpenExternal">
            Открыть файл
          </KitBtn>
          <KitBtn icon="mdi:download" @click="handleDownload">
            Скачать файл
          </KitBtn>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.preview-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-secondary-color);
  min-width: 0;
}

.file-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  height: 26px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 26px;
  box-sizing: border-box;
  border-radius: var(--r-xs);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  height: 26px;
  box-sizing: border-box;
  border-radius: var(--r-xs);
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  white-space: nowrap;
  flex-shrink: 0;

  &.privacy--public {
    color: var(--fg-success-color);
    border-color: var(--border-success-color);
    background-color: rgba(var(--fg-success-color-rgb), 0.1);
  }
}

.size-badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  box-sizing: border-box;
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  padding: 0 8px;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-xs);
  border: 1px solid var(--border-secondary-color);
  white-space: nowrap;
  flex-shrink: 0;
}

.preview-doc-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 0;
}

.topbar-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 26px;
  margin-left: auto;
}

.topbar-more-btn {
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  border-radius: var(--r-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }
}

.text-wrapper {
  width: 100%;
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
}

.text-content {
  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--fg-primary-color);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--fg-secondary-color);

  .spin {
    animation: spin 1s linear infinite;
  }
}

.unsupported-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  gap: 12px;

  .large-icon-box {
    width: 96px;
    height: 96px;
    border-radius: var(--r-l);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .preview-filename {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
    max-width: 480px;
    word-break: break-word;
  }

  .preview-desc {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
    max-width: 420px;
    margin: 0 0 8px 0;
  }

  .actions-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
