import type { Ref } from 'vue'
import type { DocumentCategory, DocumentFile } from '../models/types'
import type { TripDocumentResponse } from '~/shared/services/api/model/types'
import { ref } from 'vue'
import { useRequest } from '~/plugins/request'

export function useDocumentUpload(
  tripId: string,
  readonly: boolean,
  documents: Ref<DocumentFile[]>,
  updateDocument: (doc: DocumentFile) => Promise<void>,
) {
  const toast = useToast()
  const isUploading = ref(false)
  const uploadProgress = ref({ current: 0, total: 0 })

  async function uploadFiles(
    files: File[],
    folderId: string | null = null,
    access: 'public' | 'private' = 'private',
  ) {
    if (readonly || files.length === 0)
      return

    isUploading.value = true
    uploadProgress.value = { current: 0, total: files.length }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const res = await useRequest({
          key: `documents:upload:${Date.now()}_${i}`,
          cancelPrevious: false,
          fn: api => api.files.uploadFile(file, tripId, 'trip', 'documents', null, null, { access, folderId }),
        }) as TripDocumentResponse | null

        if (res) {
          const docAccess = res.metadata?.access || access
          const docFolderId = res.metadata?.folderId !== undefined ? res.metadata.folderId : folderId

          const newDoc: DocumentFile = {
            id: res.id,
            url: res.url,
            originalName: res.originalName,
            sizeBytes: res.sizeBytes,
            createdAt: res.createdAt,
            access: docAccess,
            folderId: docFolderId,
            title: res.metadata?.title ?? null,
            category: (res.metadata?.category as DocumentCategory) ?? null,
            isFavorite: Boolean(res.metadata?.isFavorite),
            note: res.metadata?.note ?? null,
          }

          documents.value.unshift(newDoc)

          // Синхронизация, если сервер не вернул folderId
          if (folderId && res.metadata?.folderId !== folderId) {
            await updateDocument(newDoc)
          }
        }
        uploadProgress.value.current = i + 1
      }
      toast.success(`Загружено ${files.length} файл(ов)`)
    }
    catch (err) {
      console.error('Ошибка загрузки файлов:', err)
      toast.error('Произошла ошибка при загрузке')
    }
    finally {
      isUploading.value = false
      uploadProgress.value = { current: 0, total: 0 }
    }
  }

  return {
    isUploading,
    uploadProgress,
    uploadFiles,
  }
}
