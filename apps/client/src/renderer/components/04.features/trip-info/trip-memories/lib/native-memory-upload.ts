import type { IProcessingMemory } from '../types'
import type { Memory } from '~/shared/types/models/memory'
import type { TripMedia } from '~/shared/types/models/trip'
import { invoke } from '@tauri-apps/api/core'
import { watch } from 'vue'
import { getDatabaseService } from '~/plugins/request/lib/service'
import { requireAppOnline, useConnectivity } from '~/shared/lib/connectivity'
import { SERVER_URL } from '~/shared/lib/env'
import { useAuthStore } from '~/shared/store/auth.store'

interface UploadStore {
  currentTripId: string | null
  processingMemories: Map<string, IProcessingMemory>
  memories: Memory[]
}
interface NativeStatus {
  id?: string
  tripId?: string
  accountId?: string
  ready?: boolean
  isRunning: boolean
  error?: string
  tokens?: { accessToken: string, refreshToken: string }
  items?: { id: string, status: string, progress: number, error?: string, image?: TripMedia }[]
}
const active = new WeakSet<object>()

function base64(bytes: Uint8Array) {
  const pieces: string[] = []

  for (let offset = 0; offset < bytes.length; offset += 8192)
    pieces.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))

  return btoa(pieces.join(''))
}

async function stageFile(store: UploadStore, item: IProcessingMemory, assertContext: () => void) {
  if (!item.file.size)
    throw new Error('Файл пуст')

  for (let offset = 0; offset < item.file.size; offset += 128 * 1024) {
    requireAppOnline()
    assertContext()

    if (!store.processingMemories.has(item.tempId))
      break

    const bytes = new Uint8Array(await item.file.slice(offset, offset + 128 * 1024).arrayBuffer())
    await invoke('memory_upload', { operation: 'stage', payload: { id: item.tempId, append: offset > 0, data: base64(bytes) } })
  }
}

async function prepareFiles(store: UploadStore, assertContext: () => void) {
  const pending = [...store.processingMemories.values()].filter(item => item.status === 'queued')
  const files = []

  for (const item of pending) {
    if (!store.processingMemories.has(item.tempId))
      continue

    item.status = 'uploading'
    item.preparing = true

    try {
      await stageFile(store, item, assertContext)

      if (store.processingMemories.has(item.tempId)) {
        files.push({
          id: item.tempId,
          name: item.file.name,
          type: item.file.type || 'application/octet-stream',
          size: item.file.size,
          image: item.uploadedImage,
        })
      }
    }
    catch (error) {
      item.status = 'error'
      item.error = String(error)
    }
    finally {
      item.preparing = false

      if (!store.processingMemories.has(item.tempId) || item.status === 'error')
        await invoke('memory_upload', { operation: 'cancel', payload: { id: item.tempId } })
    }

    if (item.status !== 'error')
      item.status = 'queued'
  }

  return files
}

function applyStatus(store: UploadStore, status: NativeStatus) {
  for (const task of status.items ?? []) {
    const item = store.processingMemories.get(task.id)

    if (!item)
      continue

    if (task.status === 'success' || task.status === 'cancelled') {
      URL.revokeObjectURL(item.previewUrl)
      store.processingMemories.delete(task.id)
      continue
    }

    item.progress = task.progress || 0
    item.uploadedImage = task.image
    item.status = task.status === 'error' ? 'error' : task.status === 'uploading' ? 'uploading' : 'queued'
    item.error = task.error
  }
}

function assertUploadContext(store: UploadStore, status: NativeStatus, accountId: string | undefined) {
  if (status.tripId !== store.currentTripId || status.accountId !== accountId)
    throw new Error('Контекст загрузки изменился')
}

function saveNativeTokens(status: NativeStatus, lastToken: string | undefined) {
  const auth = useAuthStore()

  if (status.tokens && status.accountId === auth.user?.id && status.tokens.accessToken !== lastToken) {
    auth.saveTokens(status.tokens)

    return status.tokens.accessToken
  }

  return lastToken
}

async function observeUpload(store: UploadStore) {
  const auth = useAuthStore()
  let lastToken: string | undefined

  while (true) {
    const status = await invoke<NativeStatus>('memory_upload', { operation: 'status' })

    if (!status.id)
      throw new Error('Фоновая загрузка прервана. Повторите отправку оставшихся файлов.')

    lastToken = saveNativeTokens(status, lastToken)

    assertUploadContext(store, status, auth.user?.id)

    applyStatus(store, status)

    if (!status.isRunning) {
      if (status.error)
        throw new Error(status.error)

      if (status.ready !== false)
        break
    }

    await new Promise(resolve => setTimeout(resolve, 750))
  }
}

function markFailed(store: UploadStore, error: unknown) {
  for (const item of store.processingMemories.values()) {
    if (item.status !== 'error') {
      item.status = 'error'
      item.preparing = false
      item.error = String(error)
    }
  }
}

async function refreshMemories(store: UploadStore, tripId: string, accountId: string | undefined) {
  const auth = useAuthStore()
  const memories = await getDatabaseService().memories.getByTripId(tripId)

  if (store.currentTripId === tripId && auth.user?.id === accountId)
    store.memories = memories
}

function continueQueuedUploads(
  store: UploadStore,
  tripId: string,
  dates: string[],
  interrupted: boolean,
  accountId: string | undefined,
) {
  if (interrupted || useAuthStore().user?.id !== accountId)
    return

  if (store.currentTripId === tripId && [...store.processingMemories.values()].some(item => item.status === 'queued'))
    void runNativeMemoryUploads(store, tripId, dates)
}

function markContextFailed(
  store: UploadStore,
  tripId: string,
  accountId: string | undefined,
  error: unknown,
) {
  if (store.currentTripId === tripId && useAuthStore().user?.id === accountId)
    markFailed(store, error)
}

export async function runNativeMemoryUploads(store: UploadStore, tripId: string, dates: string[]) {
  if (active.has(store))
    return

  active.add(store)
  const auth = useAuthStore()
  const accountId = auth.user?.id
  const { forcedOffline } = useConnectivity()
  let interrupted = false
  const assertContext = () => {
    if (interrupted || auth.user?.id !== accountId || store.currentTripId !== tripId)
      throw new Error('Контекст загрузки изменился')
  }
  const stopWatch = watch(() => [auth.user?.id, forcedOffline.value], () => {
    if (auth.user?.id !== accountId || forcedOffline.value) {
      interrupted = true
      void invoke('memory_upload', { operation: 'stop' })
    }
  })

  try {
    requireAppOnline()

    if (!await invoke<boolean>('tracking_request_notification_permission'))
      throw new Error('Разрешите уведомления для фоновой загрузки')

    const files = (await prepareFiles(store, assertContext)).filter(file => store.processingMemories.has(file.id))

    if (!files.length)
      return

    requireAppOnline()
    assertContext()
    await invoke('memory_upload', {
      operation: 'start',
      payload: {
        serverUrl: SERVER_URL,
        tripId,
        accountId,
        dates,
        files,
        accessToken: auth.tokenPair?.accessToken,
        refreshToken: auth.tokenPair?.refreshToken,
      },
    })

    await observeUpload(store)
    await refreshMemories(store, tripId, accountId)
  }
  catch (error) {
    markContextFailed(
      store,
      tripId,
      accountId,
      error,
    )
  }
  finally {
    stopWatch()
    active.delete(store)

    continueQueuedUploads(
      store,
      tripId,
      dates,
      interrupted,
      accountId,
    )
  }
}
