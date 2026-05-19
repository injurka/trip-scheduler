<script setup lang="ts">
import type { DocumentsSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useDocumentsSection } from '../composables/use-documents-section'
import DocumentItem from './document-item.vue'

interface Props {
  section: {
    id: string
    tripId: string
    type: 'documents'
    content: DocumentsSectionContent
  }
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])

const {
  isUploading,
  isFetching,
  breadcrumbs,
  visibleFolders,
  visibleDocuments,
  addFolder,
  deleteFolder,
  updateFolder,
  uploadFiles,
  deleteDocument,
  updateDocument,
  setCurrentFolder,
  currentFolderId,
  folders,
  documents,
} = useDocumentsSection(props, emit)

const isAddingFolder = ref(false)
const newFolderName = ref('')
const dropZoneRef = ref<HTMLElement>()

const editingFolderId = ref<string | null>(null)
const editingFolderName = ref('')

const vFocus = {
  mounted: (el: HTMLElement) => el.focus(),
}

const { open: openFileDialog, onChange: onFileChange, reset: resetFileDialog } = useFileDialog({
  multiple: true,
})

onFileChange((files) => {
  if (files && files.length > 0) {
    uploadFiles([...files], currentFolderId.value, 'private')
    resetFileDialog()
  }
})

const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => {
    if (files && files.length > 0 && !props.readonly) {
      uploadFiles([...files], currentFolderId.value, 'private')
    }
  },
})

function handleAddFolder() {
  if (newFolderName.value.trim()) {
    addFolder(newFolderName.value)
    newFolderName.value = ''
    isAddingFolder.value = false
  }
  else {
    isAddingFolder.value = false
  }
}

function startEditing(folder: { id: string, name: string }) {
  if (props.readonly)
    return
  editingFolderId.value = folder.id
  editingFolderName.value = folder.name
}

function saveEditing(folder: { id: string, name: string }) {
  if (editingFolderId.value === folder.id) {
    const trimmed = editingFolderName.value.trim()
    if (trimmed && trimmed !== folder.name) {
      updateFolder({ ...folder, name: trimmed })
    }
    editingFolderId.value = null
  }
}

function cancelEditing() {
  editingFolderId.value = null
}
</script>

<template>
  <div class="documents-section">
    <header v-if="!readonly || folders.length > 0 || documents.length > 0 || isFetching" class="section-header">
      <div class="breadcrumbs">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id || 'root'">
          <button
            class="crumb"
            :class="{ 'is-active': index === breadcrumbs.length - 1 }"
            @click="setCurrentFolder(crumb.id)"
          >
            <Icon v-if="index === 0" icon="mdi:folder-home-outline" class="crumb-icon" />
            <span class="crumb-text">{{ crumb.name }}</span>
          </button>
          <Icon v-if="index < breadcrumbs.length - 1" icon="mdi:chevron-right" class="crumb-separator" />
        </template>
      </div>

      <KitBtn
        v-if="!readonly"
        class="header-upload-btn"
        icon="mdi:cloud-upload-outline"
        size="sm"
        :loading="isUploading"
        @click="openFileDialog()"
      >
        <span class="upload-btn-text">Загрузить</span>
      </KitBtn>
    </header>

    <div
      ref="dropZoneRef"
      class="section-content"
      :class="{ 'is-dragging': isOverDropZone && !readonly }"
    >
      <div v-if="isFetching" class="loading-state">
        <Icon icon="mdi:loading" class="spin" />
        <p>Загрузка документов...</p>
      </div>

      <template v-else>
        <!-- Глобальное пустое состояние для режима чтения (вообще нет файлов и папок) -->
        <div v-if="readonly && folders.length === 0 && documents.length === 0" class="empty-state">
          <Icon icon="mdi:file-document-outline" />
          <p>Нет документов</p>
          <span>В этой поездке пока нет прикрепленных файлов</span>
        </div>

        <template v-else>
          <div v-if="visibleFolders.length > 0 || (!readonly && !currentFolderId)" class="folders-grid">
            <div
              v-for="folder in visibleFolders"
              :key="folder.id"
              class="folder-item"
              @click="setCurrentFolder(folder.id)"
            >
              <Icon width="24" height="24" icon="mdi:folder" class="folder-icon" />

              <span v-if="readonly" class="folder-name" :title="folder.name">
                {{ folder.name }}
              </span>
              <template v-else>
                <span
                  v-if="editingFolderId !== folder.id"
                  class="folder-name editable-name"
                  :title="folder.name"
                  @click.stop="startEditing(folder)"
                >
                  {{ folder.name }}
                </span>
                <input
                  v-else
                  v-model="editingFolderName"
                  v-focus
                  type="text"
                  class="folder-name-input"
                  @click.stop
                  @blur="saveEditing(folder)"
                  @keydown.enter="saveEditing(folder)"
                  @keydown.esc="cancelEditing"
                >
              </template>

              <button v-if="!readonly" class="delete-folder-btn" title="Удалить папку" @click.stop="deleteFolder(folder.id)">
                <Icon width="24" height="24" icon="mdi:close" />
              </button>
            </div>

            <div v-if="isAddingFolder" class="folder-item new-folder">
              <Icon width="24" height="24" icon="mdi:folder-plus" class="folder-icon" />
              <input
                v-model="newFolderName"
                v-focus
                type="text"
                placeholder="Имя папки..."
                class="new-folder-input"
                @blur="handleAddFolder"
                @keydown.enter="handleAddFolder"
                @keydown.esc="isAddingFolder = false"
              >
            </div>

            <button v-if="!readonly && !isAddingFolder && !currentFolderId" class="add-folder-btn" @click="isAddingFolder = true">
              <Icon icon="mdi:plus" />
              <span>Новая папка</span>
            </button>
          </div>

          <div v-if="visibleDocuments.length > 0" class="documents-list">
            <DocumentItem
              v-for="doc in visibleDocuments"
              :key="doc.id"
              :document="doc"
              :readonly="readonly"
              @delete="deleteDocument(doc.id)"
              @update="updateDocument"
            />
          </div>

          <div v-if="visibleFolders.length === 0 && visibleDocuments.length === 0 && !isAddingFolder" class="empty-state">
            <Icon icon="mdi:folder-open-outline" />
            <p>{{ breadcrumbs.length > 1 ? 'Эта папка пуста' : 'Документов пока нет' }}</p>
            <span v-if="!readonly">Перетащите файлы сюда или нажмите «Загрузить»</span>
            <span v-else>В этой папке нет файлов</span>
          </div>
        </template>
      </template>

      <div v-if="isOverDropZone && !readonly" class="dropzone-overlay">
        <div class="dropzone-content">
          <Icon icon="mdi:cloud-upload-outline" />
          <h3>Отпустите файлы для загрузки</h3>
          <p v-if="currentFolderId">
            В папку: {{ breadcrumbs[breadcrumbs.length - 1].name }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.documents-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  z-index: 6;
  height: 100%;

  /* Фикс от растягивания на мобильных по цепочке */
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 4px 0;
  margin-bottom: 8px;
  background-color: transparent;
  border: none;
  min-width: 0;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  flex-grow: 1;
  min-width: 0;

  .crumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--r-s);
    color: var(--fg-secondary-color);
    transition: all 0.2s;
    background: transparent;
    border: none;
    font-size: 0.95rem;
    font-weight: 500;
    max-width: 200px;
    outline: none;

    .crumb-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .crumb-icon {
      font-size: 1.2rem;
      color: var(--fg-tertiary-color);
      flex-shrink: 0;
    }

    &:not(.is-active) {
      cursor: pointer;
      &:hover,
      &:focus-visible {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);

        .crumb-icon {
          color: var(--fg-primary-color);
        }
      }
    }

    &.is-active {
      color: var(--fg-primary-color);
      font-weight: 600;
      pointer-events: none;

      .crumb-icon {
        color: var(--fg-accent-color);
      }
    }
  }

  .crumb-separator {
    color: var(--border-secondary-color);
    font-size: 1.2rem;
    flex-shrink: 0;
  }
}

.header-upload-btn {
  flex-shrink: 0;

  @media (max-width: 480px) {
    .upload-btn-text {
      display: none;
    }
  }
}

.section-content {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex-grow: 1;
  min-height: 200px;
  border-radius: var(--r-m);
  transition: all 0.2s;
  min-width: 0;

  &.is-dragging {
    background-color: rgba(var(--fg-accent-color-rgb), 0.05);
    outline: 2px dashed var(--fg-accent-color);
    outline-offset: -2px;
  }
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  min-width: 0;
}

.folder-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s;
  height: 50px;
  min-width: 0;

  &:hover {
    border-color: var(--fg-accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);

    .delete-folder-btn {
      opacity: 1;
      visibility: visible;
    }
  }

  .folder-icon {
    font-size: 1.6rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .folder-name {
    flex-grow: 1;
    font-weight: 500;
    color: var(--fg-primary-color);
    font-size: 0.95rem;

    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    width: 100%;
  }

  .editable-name {
    cursor: text;
    transition: color 0.2s;

    &:hover {
      color: var(--fg-accent-color);
    }
  }

  .folder-name-input {
    flex-grow: 1;
    font-weight: 500;
    color: var(--fg-primary-color);
    font-size: 0.95rem;
    background: transparent;
    border: none;
    border-bottom: 1px dashed var(--fg-accent-color);
    outline: none;
    min-width: 0;
    width: 100%;
    padding: 0;
  }
}

.delete-folder-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: white;
  background-color: var(--fg-error-color);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  border: 2px solid var(--bg-primary-color);

  &:hover {
    transform: scale(1.1);
  }
}

.new-folder {
  padding: 12px 16px;
  border-style: dashed;
  background-color: transparent;
}

.new-folder-input {
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  color: var(--fg-primary-color);
  font-weight: 500;
  font-size: 0.95rem;
  font-family: inherit;
}

.add-folder-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: var(--r-m);
  border: 2px dashed var(--border-secondary-color);
  color: var(--fg-secondary-color);
  background: transparent;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  height: 50px;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--fg-accent-color-rgb), 0.05);
  }
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--fg-tertiary-color);
  flex-grow: 1;

  .iconify {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .spin {
    animation: spin 1s linear infinite;
    color: var(--fg-accent-color);
    opacity: 1;
  }

  p {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    margin: 0 0 0.5rem 0;
  }
  span {
    font-size: 0.95rem;
  }
}

.dropzone-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(var(--bg-primary-color-rgb), 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-m);
  z-index: 10;
  pointer-events: none;

  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--fg-accent-color);

    .iconify {
      font-size: 5rem;
      margin-bottom: 1rem;
      animation: bounce 2s infinite ease-in-out;
    }

    h3 {
      font-size: 1.5rem;
      margin: 0;
      color: var(--fg-primary-color);
    }

    p {
      margin-top: 0.5rem;
      font-weight: 500;
    }
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
