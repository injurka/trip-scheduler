import type { DocumentFile, DocumentFolder, DocumentsSectionContent } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables'
import { TripImagePlacement } from '~/shared/types/models/trip'

interface UseDocumentsSectionProps {
  section: {
    id: string
    type: 'documents'
    content: DocumentsSectionContent
  }
  readonly: boolean
}

export function useDocumentsSection(
  props: UseDocumentsSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
  const { routeGallery } = useModuleStore(['routeGallery'])
  const confirm = useConfirm()
  const toast = useToast()

  const documents = ref<DocumentFile[]>(JSON.parse(JSON.stringify(props.section.content?.documents || [])))
  const folders = ref<DocumentFolder[]>(JSON.parse(JSON.stringify(props.section.content?.folders || [])))

  const currentFolderId = ref<string | null>(null)
  const isUploading = ref(false)

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: {
        documents: documents.value,
        folders: folders.value,
      },
    })
  }, 700)

  const breadcrumbs = computed(() => {
    const crumbs = [{ id: null, name: 'Все документы' }]
    if (currentFolderId.value) {
      const folder = folders.value.find(f => f.id === currentFolderId.value)
      if (folder) {
        crumbs.push({ id: folder.id, name: folder.name })
      }
    }
    return crumbs
  })

  const visibleFolders = computed(() => folders.value)
  const visibleDocuments = computed(() => documents.value.filter(d => d.folderId === currentFolderId.value))

  async function addFolder(name: string) {
    if (props.readonly || !name.trim())
      return
    folders.value.unshift({
      id: uuidv4(),
      name: name.trim(),
    })
  }

  async function deleteFolder(folderId: string) {
    const isConfirmed = await confirm({
      title: 'Удалить папку?',
      description: 'Все документы внутри папки будут перемещены в корень. Это действие необратимо.',
      type: 'danger',
    })
    if (isConfirmed) {
      folders.value = folders.value.filter(f => f.id !== folderId)
      documents.value.forEach((doc) => {
        if (doc.folderId === folderId) {
          doc.folderId = null
        }
      })
    }
  }

  function updateFolder(folder: DocumentFolder) {
    const index = folders.value.findIndex(f => f.id === folder.id)
    if (index !== -1) {
      folders.value[index] = folder
    }
  }

  async function uploadFiles(files: File[], folderId: string | null, access: 'public' | 'private') {
    if (props.readonly || files.length === 0)
      return

    isUploading.value = true
    try {
      for (const file of files) {
        const uploadedImage = await routeGallery.uploadImage(file, TripImagePlacement.DOCUMENTS)
        if (uploadedImage) {
          const newDocument: DocumentFile = {
            ...uploadedImage,
            access,
            folderId,
          }
          documents.value.unshift(newDocument)
        }
      }
      toast.success(`Успешно загружено ${files.length} файла(ов).`)
    }
    catch (e) {
      toast.error('Ошибка при загрузке файлов.')
    }
    finally {
      isUploading.value = false
    }
  }

  async function deleteDocument(docId: string) {
    const isConfirmed = await confirm({
      title: 'Удалить документ?',
      description: 'Это действие необратимо.',
      type: 'danger',
    })
    if (isConfirmed) {
      documents.value = documents.value.filter(d => d.id !== docId)
    }
  }

  function updateDocument(doc: DocumentFile) {
    const index = documents.value.findIndex(d => d.id === doc.id)
    if (index !== -1) {
      documents.value[index] = doc
    }
  }

  function setCurrentFolder(folderId: string | null) {
    currentFolderId.value = folderId
  }

  watch([documents, folders], debouncedUpdate, { deep: true })

  return {
    documents,
    folders,
    currentFolderId,
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
  }
}
