<script setup lang="ts">
import type { NoteType } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { onKeyStroke, useWindowSize } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useNotesSection } from '../composables/use-notes-section'
import NoteEditorExcalidraw from './components/note-editor-excalidraw.vue'
import NoteEditorMd from './components/note-editor-md.vue'
import NotesTree from './components/notes-tree.vue'
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

const {
  notesTree,
  activeNote,
  activeNoteId,
  isLoading,
  fetchNotes,
  fetchImagesUsage,
  createNote,
  updateNote,
  saveContent,
  flushPendingSave,
  deleteNote,
  reorderNotes,
  imageUsage,
} = useNotesSection(props.section.tripId, props.readonly)

const { width } = useWindowSize()
const isMobile = computed(() => width.value <= 768)
const isSidebarOpen = ref(false)
const isFullscreen = ref(false)

watch([isMobile, activeNoteId], ([mobile, noteId]) => {
  if (mobile && !noteId) {
    isSidebarOpen.value = true
  }
}, { immediate: true })

onKeyStroke('Escape', () => {
  if (isFullscreen.value) {
    isFullscreen.value = false
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

function selectNote(id: string): void {
  flushPendingSave()
  activeNoteId.value = id
  // Закрываем меню на мобильных после выбора файла
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
}

onMounted(() => {
  fetchNotes()
})

onBeforeUnmount(() => {
  flushPendingSave()
})
</script>

<template>
  <div class="notes-section">
    <div v-if="isLoading && notesTree.length === 0" class="loading-state">
      <span class="loading-spinner" />
      Загрузка заметок...
    </div>

    <div v-else class="notes-layout" :class="{ 'is-fullscreen': isFullscreen }">
      <div
        v-if="isMobile && isSidebarOpen"
        class="sidebar-overlay"
        @click="isSidebarOpen = false"
      />

      <aside
        class="notes-sidebar"
        :class="{ 'is-open': isSidebarOpen }"
      >
        <div class="sidebar-header">
          <span class="sidebar-title">Файлы</span>

          <div v-if="!readonly" class="sidebar-actions">
            <KitBtn
              icon="mdi:image-multiple-outline"
              variant="text"
              size="sm"
              title="Галерея изображений"
              @click="openGallery"
            />
            <KitBtn
              icon="mdi:folder-plus-outline"
              variant="text"
              size="sm"
              title="Новая папка"
              @click="openCreateDialog('folder')"
            />
            <KitBtn
              icon="mdi:file-document-plus-outline"
              variant="text"
              size="sm"
              title="Новая заметка"
              @click="openCreateDialog('markdown')"
            />
            <KitBtn
              icon="mdi:draw-pen"
              variant="text"
              size="sm"
              title="Новый скетч"
              @click="openCreateDialog('excalidraw')"
            />
          </div>
        </div>

        <div class="tree-wrapper">
          <NotesTree
            :nodes="notesTree"
            :active-id="activeNoteId"
            :readonly="readonly"
            :parent-id="null"
            @select="selectNote"
            @create-in="(parentId, type) => openCreateDialog(type, parentId)"
            @delete="deleteNote"
            @rename="(id, title) => updateNote(id, { title })"
            @reorder="reorderNotes"
          />

          <p v-if="notesTree.length === 0" class="empty-tree">
            Создайте первую заметку или папку
          </p>
        </div>
      </aside>

      <main class="notes-editor">
        <div class="editor-header">
          <div class="editor-header-left">
            <KitBtn
              v-if="isMobile"
              icon="mdi:menu"
              variant="text"
              size="sm"
              class="mobile-menu-btn"
              @click="isSidebarOpen = true"
            />

            <template v-if="activeNote">
              <Icon
                :icon="activeNote.type === 'excalidraw' ? 'mdi:draw' : 'mdi:file-document-outline'"
                class="editor-type-icon"
                :class="activeNote.type"
              />
              <span class="editor-title">{{ activeNote.title }}</span>
            </template>
            <span v-else class="editor-title is-empty">
              Нет открытого файла
            </span>
          </div>

          <div class="editor-header-actions">
            <template v-if="activeNote">
              <KitBtn
                v-if="!readonly && activeNote.type === 'markdown'"
                icon="mdi:image-plus-outline"
                variant="tonal"
                size="xs"
                title="Вставить фото"
                @click="openGallery"
              >
                <!-- Текст кнопки скроется/ужмется на мобилках за счет flex -->
                <span v-if="!isMobile">Вставить фото</span>
              </KitBtn>
            </template>

            <KitBtn
              :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
              variant="text"
              size="sm"
              :title="isFullscreen ? 'Свернуть' : 'На весь экран'"
              @click="isFullscreen = !isFullscreen"
            />
          </div>
        </div>

        <div class="editor-body">
          <template v-if="activeNote">
            <NoteEditorMd
              v-if="activeNote.type === 'markdown'"
              :key="activeNote.id"
              :note-id="activeNote.id"
              :content="activeNote.content"
              :readonly="readonly"
              @update:content="saveContent"
            />
            <NoteEditorExcalidraw
              v-else-if="activeNote.type === 'excalidraw'"
              :key="activeNote.id + 2"
              :note-id="activeNote.id"
              :content="activeNote.content"
              :readonly="readonly"
              @update:content="saveContent"
            />
          </template>

          <div v-else class="editor-empty">
            <Icon icon="mdi:note-edit-outline" class="editor-empty-icon" />
            <p>Выберите файл слева для редактирования</p>
          </div>
        </div>
      </main>
    </div>

    <CreateNoteDialog
      v-model:visible="isCreateDialogOpen"
      :type="createType"
      :parent-id="createParentId"
      @create="handleCreate"
    />

    <NotesGalleryDialog
      v-model:visible="isGalleryOpen"
      :trip-id="section.tripId"
      :images="imageUsage"
      :readonly="readonly"
      @refresh="fetchImagesUsage"
      @insert-image="handleInsertImage"
    />
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
  width: 280px;
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
    width: 280px;
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
  min-height: 45px;
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
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  flex-shrink: 0;
  height: 45px;

  .excalidraw {
    height: auto;
    width: auto;
  }
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
}

.editor-title {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;

  &.is-empty {
    color: var(--fg-tertiary-color);
    font-weight: normal;
    font-size: 0.9rem;
  }
}

.editor-header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.editor-body {
  flex: 1;
  overflow: hidden;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
