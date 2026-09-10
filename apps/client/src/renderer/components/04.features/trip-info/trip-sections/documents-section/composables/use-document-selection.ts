import type { ComputedRef, Ref } from 'vue'
import type { DocumentFile, DocumentFolder } from '../models/types'
import { ref } from 'vue'
import { useRequest } from '~/plugins/request'

export function useDocumentSelection(
  documents: Ref<DocumentFile[]>,
  folders: Ref<DocumentFolder[]>,
  filteredDocuments: ComputedRef<DocumentFile[]>,
  updateDocument: (doc: DocumentFile) => Promise<void>,
) {
  const confirm = useConfirm()
  const toast = useToast()

  const selectedDocIds = ref<Set<string>>(new Set())
  const isSelectionMode = ref(false)

  function toggleDocSelection(docId: string) {
    const set = new Set(selectedDocIds.value)
    if (set.has(docId)) {
      set.delete(docId)
    }
    else {
      set.add(docId)
    }
    selectedDocIds.value = set
    if (set.size > 0 && !isSelectionMode.value) {
      isSelectionMode.value = true
    }
  }

  function selectAll() {
    selectedDocIds.value = new Set(filteredDocuments.value.map(d => d.id))
    isSelectionMode.value = true
  }

  function clearSelection() {
    selectedDocIds.value = new Set()
  }

  function exitSelectionMode() {
    clearSelection()
    isSelectionMode.value = false
  }

  async function deleteSelectedDocs() {
    const count = selectedDocIds.value.size
    if (count === 0)
      return

    const isConfirmed = await confirm({
      title: `Удалить выбранные документы (${count})?`,
      description: 'Файлы будут удалены навсегда.',
      type: 'danger',
    })

    if (!isConfirmed)
      return

    const idsToDelete = Array.from(selectedDocIds.value)
    for (const id of idsToDelete) {
      await useRequest({
        key: `documents:delete:${id}`,
        fn: api => api.files.deleteFile(id),
      })
      documents.value = documents.value.filter(d => d.id !== id)
    }
    clearSelection()
    toast.success(`Удалено файлов: ${count}`)
  }

  async function moveSelectedDocs(targetFolderId: string | null) {
    const count = selectedDocIds.value.size
    if (count === 0)
      return

    const ids = Array.from(selectedDocIds.value)
    for (const id of ids) {
      const doc = documents.value.find(d => d.id === id)
      if (doc) {
        await updateDocument({ ...doc, folderId: targetFolderId })
      }
    }
    clearSelection()
    const targetName = targetFolderId ? folders.value.find(f => f.id === targetFolderId)?.name : 'Корень'
    toast.success(`Перемещено файлов (${count}) в «${targetName || 'Все документы'}»`)
  }

  return {
    selectedDocIds,
    isSelectionMode,
    toggleDocSelection,
    selectAll,
    clearSelection,
    exitSelectionMode,
    deleteSelectedDocs,
    moveSelectedDocs,
  }
}
