import type { Ref } from 'vue'
import type { DocumentCategory, DocumentFile, DocumentFolder, DocumentsSectionContent } from '../models/types'
import { folderPath, validateFolderTree } from '@injurka/type-utils'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface UseDocumentFoldersProps {
  section: {
    id: string
    tripId: string
    type: 'documents'
    content: DocumentsSectionContent
  }
  readonly: boolean
}

export function useDocumentFolders(
  props: UseDocumentFoldersProps,
  emit: (event: 'updateSection', payload: unknown) => void,
  documents: Ref<DocumentFile[]>,
  searchQuery: Ref<string>,
  selectedCategory: Ref<DocumentCategory>,
  onlyFavorites: Ref<boolean>,
  updateDocument: (doc: DocumentFile) => Promise<void>,
) {
  const confirm = useConfirm()
  const toast = useToast()
  const route = useRoute()
  const router = useRouter()

  const folders = ref<DocumentFolder[]>(JSON.parse(JSON.stringify(props.section.content?.folders || [])))
  const routeFolder = () => typeof route.query.folder === 'string' && folders.value.some(f => f.id === route.query.folder) ? route.query.folder : null
  const currentFolderId = ref<string | null>(routeFolder())
  const isAddingFolder = ref(false)

  watch(() => route.query.folder, (newFolder) => {
    currentFolderId.value = typeof newFolder === 'string' && folders.value.some(f => f.id === newFolder) ? newFolder : null
  })

  const currentFolder = computed(() => {
    if (!currentFolderId.value)
      return null

    return folders.value.find(f => f.id === currentFolderId.value) || null
  })

  watch(() => props.section.content, (content) => {
    folders.value = JSON.parse(JSON.stringify(content?.folders ?? []))

    if (currentFolderId.value && !folders.value.some(f => f.id === currentFolderId.value))
      setCurrentFolder(null)
  })

  const breadcrumbs = computed(() => [{ id: null as string | null, name: 'Все документы' }, ...folderPath(folders.value, currentFolderId.value)])

  // Статистика по папкам
  const folderStats = computed(() => {
    const map = new Map<string, { count: number, sizeBytes: number }>()
    folders.value.forEach((folder) => {
      const folderDocs = documents.value.filter(d => d.folderId === folder.id)
      map.set(folder.id, {
        count: folderDocs.length,
        sizeBytes: folderDocs.reduce((acc, d) => acc + d.sizeBytes, 0),
      })
    })

    return map
  })

  // Видимые папки (показываются только когда мы в корне и нет активного поискового запроса/категории)
  const visibleFolders = computed(() => {
    if (searchQuery.value.trim() || selectedCategory.value !== 'all' || onlyFavorites.value) {
      return []
    }

    return folders.value.filter(f => (f.parentId ?? null) === currentFolderId.value)
  })

  function persistFolders() {
    emit('updateSection', {
      ...props.section,
      content: {
        ...props.section.content,
        folders: JSON.parse(JSON.stringify(folders.value)),
      },
    })
  }

  async function addFolder(name: string) {
    if (props.readonly || !name.trim())
      return

    folders.value.push({ id: uuidv4(), name: name.trim(), parentId: currentFolderId.value })
    isAddingFolder.value = false
    persistFolders()
  }

  async function deleteFolder(folderId: string) {
    if (props.readonly)
      return

    const folder = folders.value.find(f => f.id === folderId)
    const isConfirmed = await confirm({
      title: `Удалить папку «${folder ? folder.name : ''}»?`,
      description: 'Документы и подпапки будут перемещены на уровень выше. Файлы не удаляются.',
      type: 'danger',
    })

    if (isConfirmed) {
      const parentId = folder?.parentId ?? null
      const docsToUpdate = documents.value.filter(d => d.folderId === folderId)

      for (const d of docsToUpdate) {
        await updateDocument({ ...d, folderId: parentId })

        if (documents.value.find(item => item.id === d.id)?.folderId === folderId) {
          toast.error('Папка сохранена: не удалось переместить все документы. Повторите действие.')

          return
        }
      }

      folders.value = folders.value.filter(f => f.id !== folderId).map(f => f.parentId === folderId ? { ...f, parentId } : f)

      if (currentFolderId.value === folderId) {
        setCurrentFolder(parentId)
      }

      persistFolders()
    }
  }

  function updateFolder(folder: DocumentFolder) {
    if (props.readonly || !folder.name.trim())
      return

    try {
      validateFolderTree(folders.value.map(f => f.id === folder.id ? folder : f))
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : 'Невозможно переместить папку')

      return
    }

    const index = folders.value.findIndex(f => f.id === folder.id)

    if (index !== -1) {
      folders.value[index] = folder
      persistFolders()
    }
  }

  function renameFolder(folder: DocumentFolder, newName: string) {
    updateFolder({ ...folder, name: newName })
  }

  function setCurrentFolder(folderId: string | null) {
    if (folderId && !folders.value.some(f => f.id === folderId))
      return

    if (folderId === currentFolderId.value)
      return

    currentFolderId.value = folderId
    const query = { ...route.query }

    if (folderId) {
      query.folder = folderId
    }
    else {
      delete query.folder
    }

    router.push({ query })
  }

  return {
    folders,
    currentFolderId,
    currentFolder,
    breadcrumbs,
    folderStats,
    visibleFolders,
    isAddingFolder,
    addFolder,
    deleteFolder,
    updateFolder,
    renameFolder,
    setCurrentFolder,
  }
}
