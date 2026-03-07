<script setup lang="ts">
import type { DocumentsSectionContent } from '../models/types'
import { Icon } from '@iconify/vue'
import { useFileDialog } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitEditable } from '~/components/01.kit/kit-editable'
import { useDocumentsSection } from '../composables/use-documents-section'
import DocumentItem from './document-item.vue'

interface Props {
  section: {
    id: string
    type: 'documents'
    content: DocumentsSectionContent
  }
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['updateSection'])

const {
  isUploading,
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
} = useDocumentsSection(props, emit)

const isAddingFolder = ref(false)
const newFolderName = ref('')

const { open: openFileDialog, onChange: onFileChange, reset: resetFileDialog } = useFileDialog({
  multiple: true,
})

onFileChange((files) => {
  if (files) {
    uploadFiles(Array.from(files), null, 'private')
    resetFileDialog()
  }
})

function handleAddFolder() {
  if (newFolderName.value.trim()) {
    addFolder(newFolderName.value)
    newFolderName.value = ''
    isAddingFolder.value = false
  }
}
</script>

<template>
  <div class="documents-section">
    <header class="section-header">
      <div class="breadcrumbs">
        <button
          v-for="(crumb, index) in breadcrumbs"
          :key="crumb.id || 'root'"
          class="crumb"
          :class="{ 'is-active': index === breadcrumbs.length - 1 }"
          @click="setCurrentFolder(crumb.id)"
        >
          {{ crumb.name }}
        </button>
      </div>
      <KitBtn
        v-if="!readonly"
        icon="mdi:upload"
        size="sm"
        :loading="isUploading"
        @click="openFileDialog()"
      >
        Загрузить
      </KitBtn>
    </header>

    <div class="section-content">
      <div v-if="visibleFolders.length > 0 || !readonly" class="folders-grid">
        <div
          v-for="folder in visibleFolders"
          :key="folder.id"
          class="folder-item"
          @click="setCurrentFolder(folder.id)"
        >
          <Icon icon="mdi:folder-outline" class="folder-icon" />
          <KitEditable
            :model-value="folder.name"
            class="folder-name"
            :readonly="readonly"
            @click.stop
            @update:model-value="updateFolder({ ...folder, name: $event })"
          />
          <button v-if="!readonly" class="delete-folder-btn" @click.stop="deleteFolder(folder.id)">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div v-if="isAddingFolder" class="folder-item new-folder">
          <Icon icon="mdi:folder-plus-outline" class="folder-icon" />
          <input
            v-model="newFolderName"
            v-focus
            type="text"
            placeholder="Название папки"
            class="new-folder-input"
            @blur="handleAddFolder"
            @keydown.enter="handleAddFolder"
          >
        </div>

        <button v-if="!readonly && !isAddingFolder" class="add-folder-btn" @click="isAddingFolder = true">
          <Icon icon="mdi:plus" />
          <span>Новая папка</span>
        </button>
      </div>

      <div class="documents-list">
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
        <Icon icon="mdi:file-question-outline" />
        <p>{{ breadcrumbs.length > 1 ? 'Папка пуста' : 'Документов еще нет' }}</p>
        <span v-if="!readonly">Загрузите файлы или создайте новую папку.</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.documents-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-secondary-color);
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;

  .crumb {
    color: var(--fg-secondary-color);
    transition: color 0.2s;

    &:not(.is-active):hover {
      color: var(--fg-primary-color);
    }

    &.is-active {
      color: var(--fg-primary-color);
      pointer-events: none;
    }

    &:not(:last-child)::after {
      content: '/';
      margin-left: 0.5rem;
      color: var(--fg-tertiary-color);
    }
  }
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.folder-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
    .delete-folder-btn {
      opacity: 1;
    }
  }

  .folder-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
  }

  .folder-name {
    flex-grow: 1;
    font-weight: 500;
  }
}

.delete-folder-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: var(--fg-tertiary-color);
  opacity: 0;
  transition: opacity 0.2s;
  &:hover {
    color: var(--fg-error-color);
    background-color: var(--bg-tertiary-color);
  }
}

.new-folder {
  padding: 8px;
  border-style: dashed;
}

.new-folder-input {
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  color: var(--fg-primary-color);
  font-weight: 500;
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
  font-weight: 500;
  transition: all 0.2s;
  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.documents-list {
  display: flex;
  flex-direction: column;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--fg-tertiary-color);
  .iconify {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  p {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    margin: 0;
  }
  span {
    font-size: 0.9rem;
  }
}
</style>
