import type { Ref } from 'vue'
import type { DocumentCategory, DocumentFile, DocumentFolder, DocumentsSectionContent } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
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
  emit: (event: 'updateSection', payload: any) => void,
  documents: Ref<DocumentFile[]>,
  searchQuery: Ref<string>,
  selectedCategory: Ref<DocumentCategory>,
  onlyFavorites: Ref<boolean>,
  updateDocument: (doc: DocumentFile) => Promise<void>,
) {
  const confirm = useConfirm()
  const route = useRoute()
  const router = useRouter()

  const folders = ref<DocumentFolder[]>(JSON.parse(JSON.stringify(props.section.content?.folders || [])))
  const currentFolderId = ref<string | null>((route.query.folder as string) || null)
  const isAddingFolder = ref(false)

  watch(() => route.query.folder, (newFolder) => {
    currentFolderId.value = (newFolder as string) || null
  })

  const currentFolder = computed(() => {
    if (!currentFolderId.value)
      return null
    return folders.value.find(f => f.id === currentFolderId.value) || null
  })

  const breadcrumbs = computed(() => {
    const crumbs = [{ id: null as string | null, name: 'Все документы' }]
    if (currentFolder.value) {
      crumbs.push({ id: currentFolder.value.id, name: currentFolder.value.name })
    }
    return crumbs
  })

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
    if (currentFolderId.value)
      return []
    if (searchQuery.value.trim() || selectedCategory.value !== 'all' || onlyFavorites.value) {
      return []
    }
    return folders.value
  })

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: {
        folders: folders.value,
      },
    })
  }, 400)

  async function addFolder(name: string) {
    if (props.readonly || !name.trim())
      return
    folders.value.push({ id: uuidv4(), name: name.trim() })
    isAddingFolder.value = false
    debouncedUpdate()
  }

  async function deleteFolder(folderId: string) {
    const folder = folders.value.find(f => f.id === folderId)
    const isConfirmed = await confirm({
      title: `Удалить папку «${folder?.name || ''}»?`,
      description: 'Все документы внутри папки будут перемещены в корень. Это действие необратимо.',
      type: 'danger',
    })
    if (isConfirmed) {
      folders.value = folders.value.filter(f => f.id !== folderId)
      const docsToUpdate = documents.value.filter(d => d.folderId === folderId)
      for (const d of docsToUpdate) {
        await updateDocument({ ...d, folderId: null })
      }
      if (currentFolderId.value === folderId) {
        setCurrentFolder(null)
      }
      debouncedUpdate()
    }
  }

  function updateFolder(folder: DocumentFolder) {
    const index = folders.value.findIndex(f => f.id === folder.id)
    if (index !== -1) {
      folders.value[index] = folder
      debouncedUpdate()
    }
  }

  function renameFolder(folder: DocumentFolder, newName: string) {
    updateFolder({ ...folder, name: newName })
  }

  function setCurrentFolder(folderId: string | null) {
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
