<script setup lang="ts">
import type { DocumentFile, DocumentFolder } from '../../models/types'
import { Icon } from '@iconify/vue'
import { folderPath } from '@injurka/type-utils'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'

interface Props { folders: DocumentFolder[], documents: DocumentFile[], currentFolderId: string | null, selectedDocumentId?: string, readonly: boolean, storageKey: string }

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'selectFolder', id: string | null): void
  (e: 'selectDocument', doc: DocumentFile): void
  (e: 'createFolder', name: string): void
  (e: 'updateFolder', folder: DocumentFolder): void
  (e: 'deleteFolder', id: string): void
}>()

const expanded = useStorage<string[]>(computed(() => `document-tree:${props.storageKey}`), [])

const query = ref('')
const newName = ref('')
const creating = ref(false)
const editName = ref('')
const parentId = ref('')

const searchTerm = computed(() => query.value.trim().toLocaleLowerCase())
const selectedFolder = computed(() => props.folders.find(f => f.id === props.currentFolderId))
const foldersWithChildren = computed(() => new Set([
  ...props.folders.map(folder => folder.parentId),
  ...props.documents.map(document => document.folderId),
]))
const rows = computed(() => {
  const result: Array<{ key: string, depth: number, folder?: DocumentFolder, document?: DocumentFile }> = []
  const visited = new Set<string>()
  const needle = searchTerm.value
  const matching = new Set<string>()

  if (needle) {
    for (const folder of props.folders.filter(f => f.name.toLocaleLowerCase().includes(needle)))
      folderPath(props.folders, folder.id).forEach(f => matching.add(f.id))

    for (const doc of props.documents.filter(d => (d.title || d.originalName).toLocaleLowerCase().includes(needle)))
      folderPath(props.folders, doc.folderId).forEach(f => matching.add(f.id))
  }

  function visit(parent: string | null, depth: number) {
    for (const folder of props.folders.filter(f => (f.parentId ?? null) === parent)) {
      if (visited.has(folder.id) || (needle && !matching.has(folder.id)))
        continue

      visited.add(folder.id)
      result.push({ key: folder.id, folder, depth })

      if (needle || expanded.value.includes(folder.id))
        visit(folder.id, depth + 1)
    }

    for (const document of props.documents.filter(d => (d.folderId === parent || (parent === null && !props.folders.some(f => f.id === d.folderId))) && (!needle || (d.title || d.originalName).toLocaleLowerCase().includes(needle))))
      result.push({ key: document.id, document, depth })
  }
  visit(null, 0)

  return result
})
const destinations = computed(() => props.folders.filter(f => !folderPath(props.folders, f.id).some(p => p.id === props.currentFolderId)).map(f => ({ ...f, path: folderPath(props.folders, f.id).map(p => p.name).join(' / ') })))

watch(selectedFolder, (folder) => {
  editName.value = folder?.name ?? ''
  parentId.value = folder?.parentId ?? ''
}, { immediate: true })
watch(() => props.currentFolderId, (id) => {
  expanded.value = [...new Set([...expanded.value, ...folderPath(props.folders, id).map(f => f.id)])]
}, { immediate: true })

function selectFolder(id: string | null) {
  if (id !== null && foldersWithChildren.value.has(id)) {
    const isOpen = expanded.value.includes(id)

    if (!isOpen)
      expanded.value = [...expanded.value, id]
    else if (!searchTerm.value && id === props.currentFolderId)
      expanded.value = expanded.value.filter(value => value !== id)
  }

  query.value = ''
  emit('selectFolder', id)
}
function create() {
  if (newName.value.trim()) {
    const id = props.currentFolderId

    if (id && !expanded.value.includes(id))
      expanded.value = [...expanded.value, id]

    query.value = ''
    emit('createFolder', newName.value.trim())
    newName.value = ''
    creating.value = false
  }
}
function save() {
  if (selectedFolder.value && editName.value.trim())
    emit('updateFolder', { ...selectedFolder.value, name: editName.value.trim(), parentId: parentId.value || null })
}
</script>

<template>
  <nav class="documents-tree" aria-label="Папки и файлы документов">
    <div class="tree-tools" role="search" aria-label="Поиск по дереву документов">
      <KitInput
        v-model="query"
        type="search"
        icon="mdi:magnify"
        aria-label="Найти папку или файл"
        placeholder="Папка или файл"
      />
      <KitBtn
        v-if="!readonly"
        variant="outlined"
        color="secondary"
        size="sm"
        icon="mdi:folder-plus-outline"
        aria-label="Создать папку в текущей папке"
        title="Создать папку"
        :aria-expanded="creating"
        @click="creating = !creating"
      />
    </div>
    <form v-if="creating && !readonly" class="tree-create" @submit.prevent="create">
      <input
        v-model="newName"
        autofocus
        aria-label="Название новой папки"
        placeholder="Название папки"
        required
        maxlength="200"
      ><button type="submit">
        Создать
      </button>
    </form>
    <div class="tree-body">
      <ul class="tree-list">
        <li>
          <button
            type="button"
            class="tree-entry tree-root"
            :aria-current="currentFolderId === null ? 'location' : undefined"
            @click="selectFolder(null)"
          >
            <Icon icon="mdi:folder-home-outline" class="entry-icon" />
            <span>Все документы</span>
          </button>
        </li>
        <li
          v-for="row in rows"
          :key="row.key"
          :data-depth="Math.min(row.depth, 6)"
          class="tree-row"
        >
          <button
            v-if="row.folder"
            type="button"
            class="tree-entry tree-folder"
            :aria-expanded="foldersWithChildren.has(row.key) ? !!searchTerm || expanded.includes(row.key) : undefined"
            :aria-current="currentFolderId === row.key ? 'location' : undefined"
            @click="selectFolder(row.key)"
          >
            <span class="tree-disclosure" aria-hidden="true">
              <Icon
                v-if="foldersWithChildren.has(row.key)"
                :icon="searchTerm || expanded.includes(row.key) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
              />
            </span>
            <Icon :icon="searchTerm || expanded.includes(row.key) ? 'mdi:folder-open-outline' : 'mdi:folder-outline'" class="entry-icon" />
            <span>{{ row.folder.name }}</span>
          </button>
          <button
            v-else-if="row.document"
            type="button"
            class="tree-entry tree-file"
            :aria-current="selectedDocumentId === row.key ? 'true' : undefined"
            @click="emit('selectDocument', row.document)"
          >
            <Icon icon="mdi:file-document-outline" class="entry-icon" />
            <span>{{ row.document.title || row.document.originalName }}</span>
          </button>
        </li>
      </ul>
      <p v-if="!rows.length" class="tree-hint">
        {{ searchTerm ? 'Ничего не найдено' : 'Здесь появятся папки и файлы' }}
      </p>
      <details v-if="selectedFolder && !readonly" class="folder-settings">
        <summary>Управление папкой</summary>
        <form @submit.prevent="save">
          <label>Название<input v-model="editName" required maxlength="200"></label>
          <label>Родительская папка<select v-model="parentId"><option value="">Корень</option><option v-for="folder in destinations" :key="folder.id" :value="folder.id">{{ folder.path }}</option></select></label>
          <button type="submit">
            Сохранить
          </button>
        </form>
        <button type="button" class="tree-delete" @click="emit('deleteFolder', selectedFolder.id)">
          Удалить папку
        </button>
      </details>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.documents-tree {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  font-size: 0.875rem;
}
.tree-tools,
.tree-create {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.tree-tools > * {
  min-width: 0;
}
.tree-tools .kit-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
}
.tree-body {
  overflow: auto;
  overscroll-behavior: contain;
  min-height: 0;
  scrollbar-width: thin;
}
.tree-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
@for $depth from 1 through 6 {
  .tree-row[data-depth='#{$depth}'] {
    padding-inline-start: $depth * 12px;
  }
}
.tree-entry,
.folder-settings button,
.tree-create button {
  border: 0;
  background: transparent;
  color: var(--fg-primary-color);
  cursor: pointer;
  border-radius: var(--r-s);
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  text-align: start;
}
.tree-entry {
  width: 100%;
  font-size: 0.875rem;
  line-height: 1.35;
}
.tree-entry:hover,
.folder-settings button:hover,
.tree-create button:hover {
  background: var(--bg-hover-color);
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--fg-accent-color);
  outline-offset: -2px;
}
.tree-entry[aria-current] {
  background: color-mix(in srgb, var(--fg-accent-color) 9%, transparent);
  font-weight: 600;
}
.tree-entry[aria-current] .entry-icon {
  color: var(--fg-accent-color);
}
.tree-entry span {
  overflow-wrap: anywhere;
}
.entry-icon {
  flex: 0 0 17px;
  font-size: 17px;
  color: var(--fg-secondary-color);
}
.tree-root {
  margin-bottom: 4px;
}
.tree-folder {
  gap: 6px;
}
.tree-disclosure {
  flex: 0 0 16px;
  display: grid;
  place-items: center;
  color: var(--fg-secondary-color);
}
.tree-file {
  padding-inline-start: 30px;
}
input,
select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 40px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-size: 1rem;
}
.tree-hint {
  padding-inline: 8px;
  color: var(--fg-secondary-color);
}
.folder-settings {
  border-top: 1px solid var(--border-secondary-color);
  margin-top: 8px;
}
.folder-settings summary {
  cursor: pointer;
  padding: 10px 8px;
  color: var(--fg-secondary-color);
}
.folder-settings form,
.folder-settings label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.folder-settings .tree-delete {
  color: var(--fg-error-color);
}
@media (max-width: 959px) {
  .tree-entry {
    min-height: 44px;
  }
}
</style>
