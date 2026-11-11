<script setup lang="ts">
import type { DocumentFile, DocumentsSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { folderPath } from '@injurka/type-utils'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDrawer } from '~/components/01.kit/kit-drawer'
import { KitImageViewer, useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { ErrorPlaceholder } from '~/components/02.shared/error-placeholder'
import { useConnectivity } from '~/shared/lib/connectivity'
import { resolveApiUrl } from '~/shared/lib/url'
import { useOfflineStore } from '~/shared/store/offline.store'
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
import DocumentsTree from './partials/documents-tree.vue'

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
  updateFolder,
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
// Просмотрщик картинок KitImageViewer
const imageViewer = useImageViewer()
// Загрузка через системный диалог выбора файлов
const { open: openFileDialog, onChange: onFileChange, reset: resetFileDialog } = useFileDialog({
  multiple: true,
})
const { isOnline } = useConnectivity()
const offlineStore = useOfflineStore()

const treeOpen = ref(false)
const sidebarVisible = ref(true)
const activeDocument = ref<DocumentFile | null>(null)
const dropZoneRef = ref<HTMLElement>()

// Перетаскивание файлов в основную область
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: (files) => {
    if (files && files.length > 0 && !props.readonly) {
      uploadFiles([...files], currentFolderId.value, 'private')
    }
  },
})

// Диалог редактирования документа
const editDialogVisible = ref(false)
const editingDocument = ref<DocumentFile | null>(null)
// Диалог встроенного предпросмотра
const previewDialogVisible = ref(false)
const previewDocument = ref<DocumentFile | null>(null)

const folderChoices = computed(() => folders.value.map(folder => ({ ...folder, name: folderPath(folders.value, folder.id).map(part => part.name).join(' / ') })))
const activeDocumentUrl = computed(() => activeDocument.value?.url ?? '')
const isOfflineUnavailable = computed(() => {
  if (isOnline.value)
    return false

  const entry = offlineStore.savedTrips[props.section.tripId]

  return !entry || entry.documents === undefined
})
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
    variants: d.variants || undefined,
    meta: { imageId: d.id },
  }))
})

watch(documents, (docs) => {
  if (activeDocument.value)
    activeDocument.value = docs.find(d => d.id === activeDocument.value?.id) ?? null
})

function selectTreeFolder(id: string | null) {
  setCurrentFolder(id)
  activeDocument.value = null
  treeOpen.value = false
}
function selectTreeDocument(doc: DocumentFile) {
  setCurrentFolder(doc.folderId)
  activeDocument.value = doc
  treeOpen.value = false
}
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

onFileChange((files) => {
  if (files && files.length > 0) {
    uploadFiles([...files], currentFolderId.value, 'private')
    resetFileDialog()
  }
})
</script>

<template>
  <div v-if="isOfflineUnavailable" class="documents-offline-placeholder">
    <ErrorPlaceholder
      title="Недоступно офлайн"
      message="Документы не были сохранены для работы без подключения к сети"
    />
  </div>

  <DocumentsSkeleton
    v-else-if="isFetching && documents.length === 0"
    :view-mode="viewMode"
    :show-folders="!currentFolderId"
    :readonly="readonly"
  />

  <div v-else class="documents-section">
    <div class="explorer-toggle">
      <KitBtn variant="text" icon="mdi:file-tree-outline" @click="treeOpen = true">
        Папки и файлы
      </KitBtn><KitBtn class="desktop-tree-toggle" variant="text" @click="sidebarVisible = !sidebarVisible">
        {{ sidebarVisible ? 'Скрыть панель' : 'Показать панель' }}
      </KitBtn>
    </div>
    <!-- 1. ХЕДЕР НАВИГАЦИИ И ДЕЙСТВИЙ -->
    <DocumentsHeader
      :breadcrumbs="breadcrumbs"
      :total-stats="totalStats"
      :is-selection-mode="isSelectionMode"
      :has-documents="documents.length > 0"
      :can-add-folder="true"
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
      :folders="folderChoices"
      :current-folder-id="currentFolderId"
      @select-all="selectAll"
      @clear-selection="clearSelection"
      @delete-selected="deleteSelectedDocs"
      @move-selected="moveSelectedDocs"
      @exit-selection-mode="exitSelectionMode"
    />

    <div class="documents-workspace" :class="{ 'sidebar-hidden': !sidebarVisible }">
      <aside v-if="sidebarVisible" class="documents-sidebar">
        <DocumentsTree
          :folders="folders"
          :documents="documents"
          :current-folder-id="currentFolderId"
          :selected-document-id="activeDocument?.id"
          :readonly="readonly"
          :storage-key="section.id"
          @select-folder="selectTreeFolder"
          @select-document="selectTreeDocument"
          @create-folder="addFolder"
          @update-folder="updateFolder"
          @delete-folder="deleteFolder"
        />
      </aside>
      <div class="documents-main">
        <div v-if="activeDocument" class="document-reader">
          <div class="reader-heading">
            <h3>{{ activeDocument.title || activeDocument.originalName }}</h3><KitBtn variant="text" aria-label="Открыть документ на весь экран" @click="handleOpenPreview(activeDocument)">
              <Icon icon="mdi:fullscreen" />
            </KitBtn><KitBtn variant="text" aria-label="Закрыть документ" @click="activeDocument = null">
              <Icon icon="mdi:close" />
            </KitBtn>
          </div>
          <img
            v-if="/\.(?:png|jpe?g|webp|gif|avif)(?:\?|$)/i.test(activeDocumentUrl)"
            :src="resolveApiUrl(activeDocumentUrl)"
            :alt="activeDocument.title || activeDocument.originalName"
            class="reader-image"
          >
          <DocumentPreviewDialog
            v-else
            inline
            :visible="true"
            :document="activeDocument"
          />
        </div>
        <!-- 4. ОСНОВНОЙ КОНТЕНТ (DROP ZONE) -->
        <div
          v-show="!activeDocument"
          ref="dropZoneRef"
          class="section-content"
          :class="{ 'is-dragging': isOverDropZone && !readonly }"
        >
          <!-- Глобальное пустое состояние (нет ни папок, ни файлов) -->
          <div v-if="folders.length === 0 && documents.length === 0 && !isAddingFolder" class="empty-state">
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
                  :folders="folderChoices"
                  :is-selected="selectedDocIds.has(doc.id)"
                  :is-selection-mode="isSelectionMode"
                  @delete="deleteDocument(doc.id)"
                  @update="updateDocument"
                  @preview="selectTreeDocument"
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
                <Icon
                  icon="mdi:file-search-outline"
                  width="48"
                  height="48"
                  class="empty-icon"
                />
                <h4>Ничего не найдено</h4>
                <p>Попробуйте изменить поисковый запрос или сбросить активные фильтры</p>
                <KitBtn variant="outlined" size="sm" @click="resetFilters">
                  Сбросить фильтры
                </KitBtn>
              </div>

              <!-- Папка пуста -->
              <div v-else-if="currentFolderId" class="empty-folder-state">
                <Icon
                  icon="mdi:folder-open-outline"
                  width="48"
                  height="48"
                  class="empty-icon"
                />
                <h4>Папка пуста</h4>
                <p v-if="!readonly">
                  Перетащите файлы сюда или нажмите «Загрузить»
                </p>
                <p v-else>
                  В этой папке пока нет файлов
                </p>
                <KitBtn
                  v-if="!readonly"
                  size="sm"
                  icon="mdi:cloud-upload-outline"
                  @click="openFileDialog()"
                >
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
    </div>
  </div>
  <KitDrawer
    v-model:open="treeOpen"
    side="left"
    width="320px"
    class="documents-tree-drawer"
  >
    <DialogTitle class="tree-drawer-title">
      Папки и файлы
    </DialogTitle>
    <div class="tree-drawer-content">
      <DocumentsTree
        :folders="folders"
        :documents="documents"
        :current-folder-id="currentFolderId"
        :selected-document-id="activeDocument?.id"
        :readonly="readonly"
        :storage-key="section.id"
        @select-folder="selectTreeFolder"
        @select-document="selectTreeDocument"
        @create-folder="addFolder"
        @update-folder="updateFolder"
        @delete-folder="deleteFolder"
      />
    </div>
  </KitDrawer>

  <!-- ДИАЛОГ РЕДАКТИРОВАНИЯ СВОЙСТВ ДОКУМЕНТА -->
  <DocumentEditDialog
    v-model:visible="editDialogVisible"
    :document="editingDocument"
    :folders="folderChoices"
    @save="updateDocument"
  />

  <!-- ДИАЛОГ ВСТРОЕННОГО ПРЕДПРОСМОТРА (PDF, ТЕКСТ И Т.Д.) -->
  <DocumentPreviewDialog
    v-model:visible="previewDialogVisible"
    :document="previewDocument"
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
  min-width: 0;
  width: 100%;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  gap: 14px;
  min-width: 0;
  width: 100%;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
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

.documents-offline-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 400px;
  padding: 32px 16px;
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
.documents-workspace {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.documents-workspace.sidebar-hidden {
  grid-template-columns: minmax(0, 1fr);
}
.documents-sidebar {
  position: sticky;
  top: calc(var(--safe-area-inset-top, 0px) + 72px);
  max-height: 75dvh;
  overflow: auto;
  padding: 8px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}
.documents-main,
.document-reader {
  min-width: 0;
}
.reader-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.reader-heading h3 {
  min-width: 0;
  overflow-wrap: anywhere;
}
.reader-image {
  max-width: 100%;
  max-height: 75dvh;
  object-fit: contain;
}
.explorer-toggle {
  display: flex;
  gap: 8px;
}
.explorer-toggle > :first-child {
  display: none;
}
.tree-drawer-title {
  margin: 0;
  padding: 16px 56px 16px 16px;
  font-size: 1.1rem;
}
.tree-drawer-content {
  padding: 0 12px 16px;
  min-height: 0;
  overflow-y: auto;
}
@media (max-width: 959px) {
  .documents-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .documents-sidebar,
  .desktop-tree-toggle {
    display: none;
  }
  .explorer-toggle > :first-child {
    display: inline-flex;
  }
}
</style>
