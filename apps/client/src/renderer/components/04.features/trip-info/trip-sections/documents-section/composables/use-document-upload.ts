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

  function toDocumentFile(res: TripDocumentResponse, access: 'public' | 'private', folderId: string | null): DocumentFile {
    const metadata = res.metadata || {}

    return {
      id: res.id,
      url: res.url,
      originalName: res.originalName,
      sizeBytes: res.sizeBytes,
      createdAt: res.createdAt,
      access: metadata.access || access,
      folderId: metadata.folderId !== undefined ? metadata.folderId : folderId,
      title: metadata.title ?? null,
      category: (metadata.category as DocumentCategory) ?? null,
      isFavorite: Boolean(metadata.isFavorite),
      note: metadata.note ?? null,
      variants: res.variants || (metadata as any)?.variants || null,
    }
  }

  async function uploadSingleFile(
    file: File,
    index: number,
    folderId: string | null,
    access: 'public' | 'private',
  ) {
    const res = await useRequest({
      key: `documents:upload:${Date.now()}_${index}`,
      cancelPrevious: false,
      fn: api => api.files.uploadFile(
        file,
        tripId,
        'trip',
        'documents',
        null,
        null,
        { access, folderId },
      ),
    }) as TripDocumentResponse | null

    if (!res)
      return

    const newDoc = toDocumentFile(res, access, folderId)

    documents.value.unshift(newDoc)

    if (folderId && res.metadata?.folderId !== folderId)
      await updateDocument(newDoc)
  }

  async function uploadFiles(files: File[], folderId: string | null = null, access: 'public' | 'private' = 'private') {
    if (readonly || files.length === 0)
      return

    isUploading.value = true
    uploadProgress.value = { current: 0, total: files.length }

    try {
      for (let i = 0; i < files.length; i++) {
        await uploadSingleFile(
          files[i]!,
          i,
          folderId,
          access,
        )
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
