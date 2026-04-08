<script setup lang="ts">
import type { NoteType } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { onKeyStroke, useClipboard, useWindowSize } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { useRequest } from '~/plugins/request'
import { resolveApiUrl } from '~/shared/lib/url'
import { useNotesSection } from '../composables/use-notes-section'
import NoteEditorExcalidraw from './components/note-editor-excalidraw.vue'
import NoteEditorMd from './components/note-editor-md.vue'
import NotesTree from './components/notes-tree.vue'
import CommandPaletteDialog from './dialogs/command-palette-dialog.vue'
import CreateNoteDialog from './dialogs/create-note-dialog.vue'
import NotesGalleryDialog from './dialogs/notes-gallery-dialog.vue'

interface TripSection {
  tripId: string
  [key: string]: unknown
}

const props = defineProps<{
  section: TripSection
  readonly: boolean
}>()

const tripIdRef = computed(() => props.section.tripId)
const readonlyRef = computed(() => props.readonly)

const {
  notesTree,
  flatFiles,
  activeNote,
  activeNoteId,
  isLoading,
  saveStatus,
  sortMode,
  fetchNotes,
  fetchImagesUsage,
  createNote,
  updateNote,
  saveContent,
  flushPendingSave,
  deleteNote,
  applyListUpdate,
  imageUsage,
} = useNotesSection(tripIdRef, readonlyRef)

const { width } = useWindowSize()
const isMobile = computed(() => width.value <= 768)
const isSidebarOpen = ref(false)
const isFullscreen = ref(false)

const isCommandPaletteOpen = ref(false)
const isExportMenuOpen = ref(false)
const isSortMenuOpen = ref(false)
const excalidrawRef = ref<InstanceType<typeof NoteEditorExcalidraw> | null>(null)

const { copy } = useClipboard()

watch([isMobile, activeNoteId], ([mobile, noteId]) => {
  if (mobile && !noteId)
    isSidebarOpen.value = true
}, { immediate: true })

watch(isLoading, (loading) => {
  if (!loading && notesTree.value.length > 0 && !activeNoteId.value) {
    const hash = window.location.hash
    if (hash && hash.startsWith('#note-')) {
      const id = hash.replace('#note-', '')
      if (flatFiles.value.some(f => f.id === id))
        selectNote(id)
    }
  }
})

onKeyStroke('Escape', () => {
  if (isFullscreen.value)
    isFullscreen.value = false
})

onKeyStroke('p', (e) => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    isCommandPaletteOpen.value = true
  }
})

const isCreateDialogOpen = ref(false)
const createType = ref<NoteType>('markdown')
const createParentId = ref<string | null>(null)

function openCreateDialog(type: NoteType, parentId: string | null = null): void {
  createType.value = type
  createParentId.value = parentId
  isCreateDialogOpen.value = true
}

function handleCreate(title: string): void {
  createNote({ title, type: createType.value, parentId: createParentId.value })
}

const isGalleryOpen = ref(false)

function openGallery(): void {
  fetchImagesUsage()
  isGalleryOpen.value = true
}

function handleInsertImage(markdownSnippet: string): void {
  if (!activeNote.value || activeNote.value.type !== 'markdown') {
    useToast().info('Откройте markdown-заметку, чтобы вставить изображение')
    return
  }

  const current = activeNote.value.content ?? ''
  const newContent = `${current}\n${markdownSnippet}`
  saveContent(activeNote.value.id, newContent)
}

const isUploadingPastedImage = ref(false)

async function handlePasteImage(file: File) {
  if (props.readonly)
    return
  isUploadingPastedImage.value = true
  const toast = useToast()

  await useRequest({
    key: `notes:upload-paste:${Date.now()}`,
    fn: db => db.files.uploadFile(file, props.section.tripId, 'trip', 'notes'),
    onSuccess: (data) => {
      if (data) {
        const url = resolveApiUrl(data.variants?.large ?? data.url)
        const markdownSnippet = `![image](${url})`
        handleInsertImage(markdownSnippet)
        toast.success('Изображение загружено')
      }
      isUploadingPastedImage.value = false
    },
    onError: ({ error }) => {
      toast.error(`Ошибка загрузки изображения: ${error.customMessage}`)
    },
  })
}

function selectNote(id: string): void {
  flushPendingSave()
  activeNoteId.value = id
  window.history.replaceState(null, '', `#note-${id}`)
  if (isMobile.value)
    isSidebarOpen.value = false
}

function copyDirectLink(): void {
  if (!activeNoteId.value)
    return
  const url = new URL(window.location.href)
  url.hash = `note-${activeNoteId.value}`
  copy(url.toString())
  useToast().success('Ссылка на заметку скопирована')
}

function exportMarkdown(): void {
  if (!activeNote.value || activeNote.value.type !== 'markdown')
    return
  const content = activeNote.value.content || ''
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeNote.value.title}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function exportExcalidraw(format: 'png' | 'svg'): void {
  if (!activeNote.value || !excalidrawRef.value)
    return
  excalidrawRef.value.exportImage(format, activeNote.value.title)
  isExportMenuOpen.value = false
}

onMounted(() => fetchNotes())
onBeforeUnmount(() => flushPendingSave())
</script>

<template>
  <div class="notes-section">
    <div v-if="isLoading && notesTree.length === 0" class="loading-state">
      <span class="loading-spinner" />
      Загрузка заметок...
    </div>

    <div v-else class="notes-layout" :class="{ 'is-fullscreen': isFullscreen }">
      <div v-if="isMobile && isSidebarOpen" class="sidebar-overlay" @click="isSidebarOpen = false" />

      <aside class="notes-sidebar" :class="{ 'is-open': isSidebarOpen }">
        <div class="sidebar-header">
          <span class="sidebar-title">Файлы</span>

          <div v-if="!readonly" class="sidebar-actions">
            <!-- ... Шаблон сайдбара без изменений ... -->
            <KitDropdown align="end" :open="isSortMenuOpen" @update:open="val => isSortMenuOpen = val!">
              <template #trigger>
                <KitBtn icon="mdi:sort-variant" variant="text" size="sm" title="Сортировка" />
              </template>
              <div class="sort-menu">
                <button :class="{ active: sortMode === 'manual' }" @click="sortMode = 'manual'; isSortMenuOpen = false">
                  <Icon icon="mdi:hand-back-right-outline" /> Вручную
                </button>
                <button :class="{ active: sortMode === 'name' }" @click="sortMode = 'name'; isSortMenuOpen = false">
                  <Icon icon="mdi:sort-alphabetical-variant" /> По имени
                </button>
                <button :class="{ active: sortMode === 'date' }" @click="sortMode = 'date'; isSortMenuOpen = false">
                  <Icon icon="mdi:clock-outline" /> По дате изменения
                </button>
              </div>
            </KitDropdown>

            <KitBtn icon="mdi:magnify" variant="text" size="sm" title="Поиск (Ctrl+P)" @click="isCommandPaletteOpen = true" />
            <KitBtn icon="mdi:image-multiple-outline" variant="text" size="sm" title="Галерея изображений" @click="openGallery" />
            <KitBtn icon="mdi:folder-plus-outline" variant="text" size="sm" title="Новая папка" @click="openCreateDialog('folder')" />
            <KitBtn icon="mdi:file-document-plus-outline" variant="text" size="sm" title="Новая заметка" @click="openCreateDialog('markdown')" />
            <KitBtn icon="mdi:draw-pen" variant="text" size="sm" title="Новый скетч" @click="openCreateDialog('excalidraw')" />
          </div>
        </div>

        <div class="tree-wrapper">
          <NotesTree
            :nodes="notesTree"
            :active-id="activeNoteId"
            :readonly="readonly"
            :sort-mode="sortMode"
            :parent-id="null"
            @select="selectNote"
            @create-in="(parentId, type) => openCreateDialog(type, parentId)"
            @delete="deleteNote"
            @rename="(id, title) => updateNote(id, { title })"
            @update-color="(id, color) => updateNote(id, { color })"
            @update-list="applyListUpdate"
          />
          <p v-if="notesTree.length === 0" class="empty-tree">
            Создайте первую заметку или папку
          </p>
        </div>
      </aside>

      <main class="notes-editor">
        <!-- ... Шаблон редактора без изменений ... -->
        <div class="editor-header">
          <div class="editor-header-left">
            <KitBtn v-if="isMobile" icon="mdi:menu" variant="text" size="sm" class="mobile-menu-btn" @click="isSidebarOpen = true" />
            <template v-if="activeNote">
              <Icon :icon="activeNote.type === 'excalidraw' ? 'mdi:draw' : 'mdi:file-document-outline'" class="editor-type-icon" :class="activeNote.type" />
              <div class="editor-title-wrapper">
                <span class="editor-title">{{ activeNote.title }}</span>
              </div>
              <div v-if="!readonly" class="save-status-indicator">
                <template v-if="isUploadingPastedImage">
                  <Icon icon="mdi:loading" class="spin status-icon text-accent" /><span>Загрузка...</span>
                </template>
                <template v-else-if="saveStatus === 'saving'">
                  <Icon icon="mdi:loading" class="spin status-icon text-accent" /><span>Сохраняется...</span>
                </template>
                <template v-else-if="saveStatus === 'pending'">
                  <Icon icon="mdi:pencil-outline" class="status-icon text-tertiary" /><span class="text-tertiary">Изменено</span>
                </template>
                <template v-else-if="saveStatus === 'error'">
                  <Icon icon="mdi:cloud-alert" class="status-icon text-error" /><span class="text-error">Ошибка</span>
                </template>
                <template v-else>
                  <Icon icon="mdi:cloud-check-outline" class="status-icon text-success" /><span class="text-success">Сохранено</span>
                </template>
              </div>
            </template>
            <span v-else class="editor-title is-empty">Нет открытого файла</span>
          </div>

          <div class="editor-header-actions">
            <template v-if="activeNote">
              <KitBtn icon="mdi:link-variant" variant="text" size="sm" title="Скопировать ссылку" @click="copyDirectLink" />
              <KitBtn v-if="!readonly && activeNote.type === 'markdown'" icon="mdi:image-plus-outline" variant="text" size="sm" title="Вставить фото" @click="openGallery" />
              <KitBtn v-if="activeNote.type === 'markdown'" icon="mdi:download-outline" variant="text" size="sm" title="Скачать .md" @click="exportMarkdown" />
              <KitDropdown v-if="activeNote.type === 'excalidraw'" :open="isExportMenuOpen" align="end" @update:open="val => isExportMenuOpen = val!">
                <template #trigger>
                  <KitBtn icon="mdi:download-outline" variant="text" size="sm" title="Скачать скетч" />
                </template>
                <div class="export-menu">
                  <button @click="exportExcalidraw('png')">
                    Скачать как PNG
                  </button>
                  <button @click="exportExcalidraw('svg')">
                    Скачать как SVG
                  </button>
                </div>
              </KitDropdown>
            </template>
            <KitBtn :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" variant="text" size="sm" :title="isFullscreen ? 'Свернуть' : 'На весь экран'" @click="isFullscreen = !isFullscreen" />
          </div>
        </div>

        <div class="editor-body">
          <template v-if="activeNote">
            <NoteEditorMd v-if="activeNote.type === 'markdown'" :key="activeNote.id" :note-id="activeNote.id" :content="activeNote.content" :readonly="readonly" @update:content="saveContent" @upload-image="handlePasteImage" />
            <NoteEditorExcalidraw v-else-if="activeNote.type === 'excalidraw'" :key="activeNote.id + 2" ref="excalidrawRef" :note-id="activeNote.id" :content="activeNote.content" :readonly="readonly" @update:content="saveContent" />
          </template>
          <div v-else class="editor-empty">
            <Icon icon="mdi:note-edit-outline" class="editor-empty-icon" />
            <p>Выберите файл слева для редактирования</p>
            <p class="editor-hint">
              Нажмите <kbd>Ctrl</kbd> + <kbd>P</kbd> для поиска
            </p>
          </div>
        </div>
      </main>
    </div>

    <CreateNoteDialog v-model:visible="isCreateDialogOpen" :type="createType" :parent-id="createParentId" @create="handleCreate" />
    <NotesGalleryDialog v-model:visible="isGalleryOpen" :trip-id="section.tripId" :images="imageUsage" :readonly="readonly" @refresh="fetchImagesUsage" @insert-image="handleInsertImage" />
    <CommandPaletteDialog v-model:visible="isCommandPaletteOpen" :files="flatFiles" @select="selectNote" />
  </div>
</template>

<style scoped lang="scss">
.notes-section {
  height: 70vh;
  min-height: calc(100vh - 150px);
  max-width: 1600px;
  width: 100%;
  display: flex;
  margin: 0 auto;
  flex-direction: column;
  padding: 10px;
  z-index: 6;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-secondary-color);
  border-top-color: var(--fg-accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

.notes-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;

  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-primary-color);

  &.is-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    border-radius: 0;
    border: none;
    margin: 0;
    top: 0px;
    left: 0;
    bottom: 0;
    right: 0;
  }
}

.sidebar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
  backdrop-filter: blur(2px);
}

.notes-sidebar {
  width: 300px;
  min-width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 50;

  @include media-down(sm) {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    max-width: 85%;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &.is-open {
      transform: translateX(0);
    }
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 12px;
  border-bottom: 1px solid var(--border-secondary-color);
  gap: 8px;
  flex-shrink: 0;
  height: 50px;
}

.sidebar-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  white-space: nowrap;
}

.sidebar-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.sort-menu {
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 180px;

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    text-align: left;
    border-radius: var(--r-xs);
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--fg-primary-color);
    width: 100%;
    transition: background-color 0.15s;

    &:hover {
      background: var(--bg-hover-color);
    }

    &.active {
      color: var(--fg-accent-color);
      background: rgba(var(--bg-accent-overlay-color-rgb), 0.3);
    }

    .iconify {
      font-size: 1.1rem;
      flex-shrink: 0;
    }
  }
}

.tree-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.empty-tree {
  padding: 24px 12px;
  text-align: center;
  color: var(--fg-tertiary-color);
  font-size: 0.825rem;
  margin: 0;
}

.notes-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--bg-primary-color);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  flex-shrink: 0;
  height: 50px;
}

.editor-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.mobile-menu-btn {
  margin-left: -8px;
}

.editor-type-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  color: var(--fg-secondary-color);
  width: 22px;
  height: 22px;
}

.editor-title-wrapper {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.editor-title {
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  line-height: 1.2;

  &.is-empty {
    color: var(--fg-tertiary-color);
    font-weight: normal;
    font-size: 0.9rem;
  }
}

.save-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: var(--r-xs);
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  margin-left: auto;

  span {
    white-space: nowrap;
  }

  .status-icon {
    font-size: 0.9rem;
  }

  .text-success {
    color: var(--fg-success-color);
  }
  .text-accent {
    color: var(--fg-accent-color);
  }
  .text-tertiary {
    color: var(--fg-tertiary-color);
  }
  .text-error {
    color: var(--fg-error-color);
  }
}

.editor-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.export-menu {
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 160px;

  button {
    padding: 8px 12px;
    background: transparent;
    border: none;
    text-align: left;
    border-radius: var(--r-xs);
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--fg-primary-color);
    width: 100%;
    transition: background-color 0.15s;

    &:hover {
      background: var(--bg-hover-color);
    }
  }
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fg-tertiary-color);
  gap: 12px;

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.editor-empty-icon {
  font-size: 3rem;
  opacity: 0.35;
}

.editor-hint {
  font-size: 0.8rem !important;
  opacity: 0.7;
  margin-top: 8px !important;

  kbd {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-xs);
    padding: 2px 6px;
    font-family: inherit;
    font-size: 0.75rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}
</style>
