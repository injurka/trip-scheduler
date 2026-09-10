<script setup lang="ts">
import type { DocumentFile, DocumentsSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useDocumentsSection } from '../composables/use-documents-section'
import DocumentEditDialog from './document-edit-dialog.vue'
import DocumentItem from './document-item.vue'
import DocumentPreviewDialog from './document-preview-dialog.vue'
import DocumentsSkeleton from './documents-skeleton.vue'
import {
  DocumentsBulkBar,
  DocumentsDropzoneOverlay,
  DocumentsFoldersGrid,
  DocumentsHeader,
  DocumentsToolbar,
  DocumentsViewBar,
} from './partials'

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
  uploadProgress,
  isFetching,
  breadcrumbs,
  visibleFolders,
  filteredDocuments,
  folderStats,
  totalStats,
  searchQuery,
  selectedCategory,
  onlyFavorites,
  sortOption,
  viewMode,
  sortOptions,
  categoryCounts,
  selectedDocIds,
  isSelectionMode,
  addFolder,
  deleteFolder,
  renameFolder,
  uploadFiles,
  deleteDocument,
  updateDocument,
  toggleFavorite,
  moveDocument,
  toggleDocSelection,
  selectAll,
  clearSelection,
  exitSelectionMode,
  deleteSelectedDocs,
  moveSelectedDocs,
  setCurrentFolder,
  currentFolderId,
  currentFolder,
  folders,
  documents,
  isAddingFolder,
  resetFilters,
} = useDocumentsSection(props, emit)

const dropZoneRef = ref<HTMLElement>()

// Диалог редактирования документа
const editDialogVisible = ref(false)
const editingDocument = ref<DocumentFile | null>(null)

// Диалог встроенного предпросмотра
const previewDialogVisible = ref(false)
const previewDocument = ref<DocumentFile | null>(null)

// Просмотрщик картинок KitImageViewer
const imageViewer = useImageViewer()

const imageDocuments = computed(() => {
  return filteredDocuments.value.filter((d) => {
    const ext = d.url.split('.').pop()?.toLowerCase().split('?')[0] || ''
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(ext)
  })
})

const viewerImages = computed(() => {
  return imageDocuments.value.map(d => ({
    url: d.url,
    alt: d.title || d.originalName,
    meta: { imageId: d.id },
  }))
})

// Загрузка через системный диалог выбора файлов
const { open: openFileDialog, onChange: onFileChange, reset: resetFileDialog } = useFileDialog({
  multiple: true,
})

onFileChange((files) => {
  if (files && files.length > 0) {
    uploadFiles([...files], currentFolderId.value, 'private')
    resetFileDialog()
  }
})

// Перетаскивание файлов в основную область
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => {
    if (files && files.length > 0 && !props.readonly) {
      uploadFiles([...files], currentFolderId.value, 'private')
    }
  },
})

function handleOpenPreview(doc: DocumentFile) {
  const ext = doc.url.split('.').pop()?.toLowerCase().split('?')[0] || ''
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(ext)

  if (isImg) {
    const index = viewerImages.value.findIndex(img => img.meta.imageId === doc.id)
    if (index !== -1) {
      imageViewer.open(viewerImages.value, index)
      return
    }
  }

  previewDocument.value = doc
  previewDialogVisible.value = true
}

function handleOpenEdit(doc: DocumentFile) {
  editingDocument.value = { ...doc }
  editDialogVisible.value = true
}
</script>

<template>
  <DocumentsSkeleton
    v-if="isFetching && documents.length === 0"
    :view-mode="viewMode"
    :show-folders="!currentFolderId"
  />

  <div v-else class="documents-section">
    <!-- 1. ХЕДЕР НАВИГАЦИИ И ДЕЙСТВИЙ -->
    <DocumentsHeader
      :breadcrumbs="breadcrumbs"
      :total-stats="totalStats"
      :is-selection-mode="isSelectionMode"
      :has-documents="documents.length > 0"
      :can-add-folder="!currentFolderId"
      :readonly="readonly"
      :is-uploading="isUploading"
      :upload-progress="uploadProgress"
      @select-crumb="setCurrentFolder"
      @toggle-selection-mode="isSelectionMode = !isSelectionMode"
      @add-folder="isAddingFolder = true"
      @open-upload="openFileDialog()"
    />

    <!-- 2. ТУЛБАР ФИЛЬТРОВ И ПОИСКА -->
    <DocumentsToolbar
      v-if="documents.length > 0"
      v-model:search-query="searchQuery"
      v-model:selected-category="selectedCategory"
      v-model:only-favorites="onlyFavorites"
      :favorites-count="totalStats.favoritesCount"
      :category-counts="categoryCounts"
    />

    <!-- 3. ПАНЕЛЬ МАССОВЫХ ДЕЙСТВИЙ -->
    <DocumentsBulkBar
      v-if="isSelectionMode"
      :selected-count="selectedDocIds.size"
      :total-filtered-count="filteredDocuments.length"
      :folders="folders"
      :current-folder-id="currentFolderId"
      @select-all="selectAll"
      @clear-selection="clearSelection"
      @delete-selected="deleteSelectedDocs"
      @move-selected="moveSelectedDocs"
      @exit-selection-mode="exitSelectionMode"
    />

    <!-- 4. ОСНОВНОЙ КОНТЕНТ (DROP ZONE) -->
    <div
      ref="dropZoneRef"
      class="section-content"
      :class="{ 'is-dragging': isOverDropZone && !readonly }"
    >
      <!-- Глобальное пустое состояние (нет ни папок, ни файлов) -->
      <div v-if="folders.length === 0 && documents.length === 0" class="empty-state">
        <div class="empty-illustration">
          <Icon icon="mdi:folder-file-outline" width="64" height="64" />
        </div>
        <h3>Документов пока нет</h3>
        <p v-if="!readonly">
          Прикрепляйте сюда электронные билеты, брони отелей, страховки, визы и важные памятки для поездки.
        </p>
        <p v-else>
          В этой поездке пока нет прикрепленных документов.
        </p>

        <div v-if="!readonly" class="empty-actions">
          <KitBtn icon="mdi:cloud-upload-outline" @click="openFileDialog()">
            Загрузить первый документ
          </KitBtn>
          <KitBtn variant="outlined" icon="mdi:folder-plus-outline" @click="isAddingFolder = true">
            Создать папку
          </KitBtn>
        </div>
      </div>

      <template v-else>
        <!-- БЛОК ПАПОК (Только в корне и без поисковых фильтров) -->
        <DocumentsFoldersGrid
          v-if="visibleFolders.length > 0 || isAddingFolder"
          :folders="folders"
          :visible-folders="visibleFolders"
          :folder-stats="folderStats"
          :readonly="readonly"
          :is-adding-folder="isAddingFolder"
          @select-folder="setCurrentFolder"
          @rename-folder="renameFolder"
          @delete-folder="deleteFolder"
          @create-folder="addFolder"
          @cancel-create-folder="isAddingFolder = false"
        />

        <!-- БЛОК ДОКУМЕНТОВ -->
        <div class="docs-block">
          <DocumentsViewBar
            v-model:sort-option="sortOption"
            v-model:view-mode="viewMode"
            :current-folder="currentFolder"
            :count="filteredDocuments.length"
            :sort-options="sortOptions"
          />

          <!-- Документы найдены -->
          <div
            v-if="filteredDocuments.length > 0"
            :class="viewMode === 'grid' ? 'documents-grid' : 'documents-list'"
          >
            <DocumentItem
              v-for="doc in filteredDocuments"
              :key="doc.id"
              :document="doc"
              :readonly="readonly"
              :view-mode="viewMode"
              :folders="folders"
              :is-selected="selectedDocIds.has(doc.id)"
              :is-selection-mode="isSelectionMode"
              @delete="deleteDocument(doc.id)"
              @update="updateDocument"
              @preview="handleOpenPreview"
              @edit="handleOpenEdit"
              @toggle-select="toggleDocSelection"
              @toggle-favorite="toggleFavorite(doc)"
              @move="targetFolderId => moveDocument(doc, targetFolderId)"
            />
          </div>

          <!-- Ничего не найдено по фильтрам поиска -->
          <div
            v-else-if="searchQuery.trim() || selectedCategory !== 'all' || onlyFavorites"
            class="filter-empty-state"
          >
            <Icon icon="mdi:file-search-outline" width="48" height="48" class="empty-icon" />
            <h4>Ничего не найдено</h4>
            <p>Попробуйте изменить поисковый запрос или сбросить активные фильтры</p>
            <KitBtn variant="outlined" size="sm" @click="resetFilters">
              Сбросить фильтры
            </KitBtn>
          </div>

          <!-- Папка пуста -->
          <div v-else-if="currentFolderId" class="empty-folder-state">
            <Icon icon="mdi:folder-open-outline" width="48" height="48" class="empty-icon" />
            <h4>Папка пуста</h4>
            <p v-if="!readonly">
              Перетащите файлы сюда или нажмите «Загрузить»
            </p>
            <p v-else>
              В этой папке пока нет файлов
            </p>
            <KitBtn v-if="!readonly" size="sm" icon="mdi:cloud-upload-outline" @click="openFileDialog()">
              Загрузить в эту папку
            </KitBtn>
          </div>
        </div>
      </template>

      <!-- ОВЕРЛЕЙ DRAG & DROP ПРИ ПЕРЕТАСКИВАНИИ -->
      <DocumentsDropzoneOverlay
        v-if="isOverDropZone && !readonly"
        :folder-name="currentFolder?.name || null"
      />
    </div>
  </div>

  <!-- ДИАЛОГ РЕДАКТИРОВАНИЯ СВОЙСТВ ДОКУМЕНТА -->
  <DocumentEditDialog
    v-model:visible="editDialogVisible"
    :document="editingDocument"
    :folders="folders"
    @save="updateDocument"
  />

  <!-- ДИАЛОГ ВСТРОЕННОГО ПРЕДПРОСМОТРА (PDF, ТЕКСТ И Т.Д.) -->
  <DocumentPreviewDialog
    v-model:visible="previewDialogVisible"
    :document="previewDocument"
    @download="doc => updateDocument(doc)"
  />

  <!-- ПРОСМОТРЩИК ИЗОБРАЖЕНИЙ (KIT IMAGE VIEWER) -->
  <KitImageViewer
    v-if="imageViewer.isOpen.value"
    v-model:visible="imageViewer.isOpen.value"
    v-model:current-index="imageViewer.currentIndex.value"
    :images="viewerImages"
    :show-counter="true"
    :enable-thumbnails="true"
  />
</template>

<style scoped lang="scss">
.documents-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 6;
  height: 100%;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.section-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  position: relative;
  transition: all 0.2s;

  &.is-dragging {
    outline: 2px dashed var(--fg-accent-color);
    outline-offset: -2px;
    border-radius: var(--r-m);
  }
}

/* ==================== СПИСОК / СЕТКА ДОКУМЕНТОВ ==================== */
.docs-block {
  display: flex;
  flex-direction: column;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ==================== EMPTY STATES ==================== */
.empty-state,
.empty-folder-state,
.filter-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1.5rem;
  color: var(--fg-tertiary-color);

  .empty-icon {
    opacity: 0.4;
    margin-bottom: 0.5rem;
  }

  h3,
  h4 {
    color: var(--fg-primary-color);
    margin: 0 0 0.5rem 0;
  }

  p {
    font-size: 0.92rem;
    max-width: 440px;
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }
}

.empty-illustration {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background-color: var(--bg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  color: var(--fg-tertiary-color);
  opacity: 0.8;
}

.empty-actions {
  display: flex;
  gap: 12px;
  margin-top: 0.5rem;
}
</style>
