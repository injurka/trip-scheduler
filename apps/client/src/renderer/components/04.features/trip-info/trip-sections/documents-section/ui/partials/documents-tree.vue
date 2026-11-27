<script setup lang="ts">
import type { DocumentFile, DocumentFolder } from '../../models/types'
import { Icon } from '@iconify/vue'
import { folderPath } from '@injurka/type-utils'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

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

const selectedFolder = computed(() => props.folders.find(f => f.id === props.currentFolderId))
const rows = computed(() => {
  const result: Array<{ key: string, depth: number, folder?: DocumentFolder, document?: DocumentFile }> = []
  const visited = new Set<string>()
  const needle = query.value.trim().toLocaleLowerCase()
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

function toggle(id: string) {
  expanded.value = expanded.value.includes(id) ? expanded.value.filter(value => value !== id) : [...expanded.value, id]
}
function create() {
  if (newName.value.trim()) {
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
    <div class="tree-tools">
      <button type="button" :aria-current="currentFolderId === null ? 'location' : undefined" @click="emit('selectFolder', null)">
        <Icon icon="mdi:folder-home-outline" />Все документы
      </button>
      <button
        v-if="!readonly"
        type="button"
        aria-label="Создать папку в текущей папке"
        @click="creating = !creating"
      >
        <Icon icon="mdi:folder-plus-outline" />
      </button>
    </div>
    <input
      v-model="query"
      class="tree-search"
      type="search"
      aria-label="Найти папку или файл"
      placeholder="Найти папку или файл"
    >
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
    <ul class="tree-list">
      <li
        v-for="row in rows"
        :key="row.key"
        :style="{ paddingLeft: `${Math.min(row.depth, 12) * 12}px` }"
        class="tree-row"
      >
        <template v-if="row.folder">
          <button
            type="button"
            class="tree-expand"
            :aria-expanded="!!query || expanded.includes(row.key)"
            :aria-label="`Раскрыть папку ${row.folder.name}`"
            @click="toggle(row.key)"
          >
            <Icon :icon="expanded.includes(row.key) || query ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
          </button>
          <button
            type="button"
            class="tree-entry"
            :aria-current="currentFolderId === row.key ? 'location' : undefined"
            @click="emit('selectFolder', row.key)"
          >
            <Icon icon="mdi:folder-outline" /><span>{{ row.folder.name }}</span>
          </button>
        </template>
        <button
          v-else-if="row.document"
          type="button"
          class="tree-entry tree-file"
          :aria-current="selectedDocumentId === row.key ? 'true' : undefined"
          @click="emit('selectDocument', row.document)"
        >
          <Icon icon="mdi:file-document-outline" /><span>{{ row.document.title || row.document.originalName }}</span>
        </button>
      </li>
    </ul>
    <p v-if="!rows.length" class="tree-hint">
      {{ query ? 'Ничего не найдено' : 'Здесь появятся папки и файлы' }}
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
  </nav>
</template>

<style scoped lang="scss">
.documents-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  font-size: 0.875rem;
}
.tree-tools {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}
button {
  border: 0;
  background: transparent;
  color: var(--fg-primary-color);
  cursor: pointer;
  border-radius: var(--r-s);
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  text-align: left;
}
button:hover {
  background: var(--bg-tertiary-color);
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--fg-accent-color);
}
button[aria-current] {
  color: var(--fg-accent-color);
  background: color-mix(in srgb, var(--fg-accent-color) 10%, transparent);
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
  font-size: 16px;
}
.tree-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tree-row {
  display: flex;
  align-items: flex-start;
  min-width: 0;
}
.tree-expand {
  flex: 0 0 32px;
  padding: 8px 4px;
}
.tree-entry {
  flex: 1;
  min-width: 0;
}
.tree-entry span {
  overflow-wrap: anywhere;
}
.tree-entry svg {
  flex-shrink: 0;
}
.tree-file {
  margin-left: 32px;
}
.tree-hint {
  color: var(--fg-secondary-color);
}
.folder-settings {
  border-top: 1px solid var(--border-secondary-color);
  padding-top: 8px;
}
.folder-settings summary {
  cursor: pointer;
  min-height: 40px;
}
.folder-settings form,
.folder-settings label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tree-delete {
  color: var(--fg-error-color);
}
@media (max-width: 599px) {
  button,
  input,
  select {
    min-height: 44px;
  }
}
</style>
