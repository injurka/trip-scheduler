import type { Ref } from 'vue'
import type { NoteImageUsage, NoteType, ReorderNoteUpdate, TripNote } from '~/shared/services/api/model/types'
import { useStorage } from '@vueuse/core'
import { computed, ref, unref } from 'vue'
import { useRequest, useRequestStatus, useRequestStatusByPrefix } from '~/plugins/request'

export interface NoteTreeNode extends TripNote {
  children: NoteTreeNode[]
}

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'
export type SortMode = 'manual' | 'name' | 'date'

export const NOTES_KEYS = {
  FETCH_NOTES: 'notes:fetch',
  FETCH_IMAGES: 'notes:fetch-images',
  CREATE_NOTE: 'notes:create',
  UPDATE_NOTE: 'notes:update',
  DELETE_NOTE: 'notes:delete',
  REORDER_NOTES: 'notes:reorder',
} as const

function parseImageIds(content: string | null): string[] {
  if (!content)
    return []
  const pattern = /id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi
  const ids = new Set<string>()
  let match: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(content)) !== null) {
    if (match[1])
      ids.add(match[1].toLowerCase())
  }
  return [...ids]
}

export function useNotesSection(tripIdRef: Ref<string> | string, readonlyRef: Ref<boolean> | boolean) {
  const tripId = computed(() => unref(tripIdRef))
  const readonly = computed(() => unref(readonlyRef))

  const notes = ref<TripNote[]>([])
  const imageUsage = ref<NoteImageUsage[]>([])
  const activeNoteId = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('saved')
  const sortMode = useStorage<SortMode>(`notes:sort:${tripId.value}`, 'manual')

  const isNotesLoading = useRequestStatus(NOTES_KEYS.FETCH_NOTES)
  const isSaving = useRequestStatusByPrefix(NOTES_KEYS.CREATE_NOTE)
  const isUpdating = useRequestStatusByPrefix(NOTES_KEYS.UPDATE_NOTE)

  const activeNote = computed((): TripNote | null =>
    notes.value.find(n => n.id === activeNoteId.value) ?? null,
  )

  const flatFiles = computed(() => notes.value.filter(n => n.type !== 'folder'))

  const notesTree = computed((): NoteTreeNode[] => {
    const map = new Map<string, NoteTreeNode>()
    for (const note of notes.value) {
      map.set(note.id, { ...note, children: [] })
    }

    const roots: NoteTreeNode[] = []

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node)
      }
      else {
        roots.push(node)
      }
    }

    const sortNodes = (nodes: NoteTreeNode[]): void => {
      nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder')
          return -1
        if (a.type !== 'folder' && b.type === 'folder')
          return 1

        if (sortMode.value === 'name')
          return a.title.localeCompare(b.title)
        if (sortMode.value === 'date') {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime()
          const dateB = new Date(b.updatedAt || b.createdAt).getTime()
          return dateB - dateA
        }

        return a.order - b.order
      })
      for (const node of nodes) sortNodes(node.children)
    }

    sortNodes(roots)
    return roots
  })

  async function fetchNotes(): Promise<void> {
    await useRequest({
      key: NOTES_KEYS.FETCH_NOTES,
      fn: db => db.notes.getByTripId(tripId.value),
      onSuccess: (data) => { notes.value = data ?? [] },
      onError: ({ error }) => { useToast().error(`Не удалось загрузить заметки: ${error.customMessage}`) },
    })
  }

  async function fetchImagesUsage(): Promise<void> {
    await useRequest({
      key: NOTES_KEYS.FETCH_IMAGES,
      fn: db => db.notes.getImagesUsage(tripId.value),
      onSuccess: (data) => { imageUsage.value = data ?? [] },
    })
  }

  async function createNote(data: { title: string, type: NoteType, parentId: string | null }): Promise<void> {
    if (readonly.value)
      return

    const siblings = notes.value.filter(n => n.parentId === data.parentId)
    const order = siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) + 1 : 0

    await useRequest({
      // Уникальный ключ не блокирует параллельные запросы
      key: `${NOTES_KEYS.CREATE_NOTE}:${Date.now()}`,
      fn: db => db.notes.create({ tripId: tripId.value, ...data, order }),
      onSuccess: (newNote) => {
        if (!newNote)
          return
        notes.value.push(newNote)
        if (newNote.type !== 'folder') {
          activeNoteId.value = newNote.id
        }
      },
      onError: ({ error }) => { useToast().error(`Ошибка при создании: ${error.customMessage}`) },
    })
  }

  async function updateNote(
    id: string,
    data: { title?: string, content?: string | null, parentId?: string | null, color?: string | null },
  ): Promise<void> {
    if (readonly.value)
      return

    const index = notes.value.findIndex(n => n.id === id)
    if (index === -1)
      return

    // Оптимистичное локальное применение
    notes.value[index] = { ...notes.value[index]!, ...data }

    const imageIds = data.content !== undefined ? parseImageIds(data.content) : undefined

    await useRequest({
      // Уникальный ключ предотвращает потерю запросов при быстром вводе
      key: `${NOTES_KEYS.UPDATE_NOTE}:${id}:${Date.now()}`,
      fn: db => db.notes.update({ id, ...data, imageIds }),
      onSuccess: (updated) => {
        if (updated) {
          const currentNote = notes.value.find(n => n.id === id)
          if (currentNote) {
            // НЕ перезатираем контент с сервера (пользователь мог продолжить набор текста)
            notes.value[notes.value.indexOf(currentNote)] = {
              ...updated,
              content: currentNote.content,
              title: currentNote.title,
            }
          }
        }
        saveStatus.value = 'saved'
      },
      onError: ({ error }) => {
        saveStatus.value = 'error'
        useToast().error(`Ошибка при обновлении: ${error.customMessage}`)
      },
    })
  }

  const pendingSaves = new Map<string, { content: string | null, timer: ReturnType<typeof setTimeout> }>()

  function saveContent(id: string, content: string | null): void {
    const noteIndex = notes.value.findIndex(n => n.id === id)
    if (noteIndex !== -1) {
      notes.value[noteIndex].content = content
    }

    saveStatus.value = 'pending'

    const existing = pendingSaves.get(id)
    if (existing?.timer)
      clearTimeout(existing.timer)

    const timer = setTimeout(() => {
      pendingSaves.delete(id)
      saveStatus.value = 'saving'
      updateNote(id, { content })
    }, 1200)

    pendingSaves.set(id, { content, timer })
  }

  function flushPendingSave(): void {
    for (const [id, pending] of pendingSaves.entries()) {
      clearTimeout(pending.timer)
      saveStatus.value = 'saving'
      updateNote(id, { content: pending.content })
    }
    pendingSaves.clear()
  }

  async function deleteNote(id: string): Promise<void> {
    if (readonly.value)
      return

    const isConfirmed = await useConfirm()({
      title: 'Удалить?',
      description: 'Файл или папка со всем содержимым будет удалена навсегда.',
      type: 'danger',
    })
    if (!isConfirmed)
      return

    await useRequest({
      key: `${NOTES_KEYS.DELETE_NOTE}:${id}`,
      fn: db => db.notes.delete(id),
      onSuccess: () => {
        if (activeNoteId.value === id)
          activeNoteId.value = null

        const toRemove = new Set<string>()
        const collectDescendants = (noteId: string): void => {
          toRemove.add(noteId)
          notes.value.filter(n => n.parentId === noteId).forEach(n => collectDescendants(n.id))
        }
        collectDescendants(id)
        notes.value = notes.value.filter(n => !toRemove.has(n.id))
      },
    })
  }

  // Система буферизации для Drag&Drop реордеринга
  const pendingReorders = new Map<string, ReorderNoteUpdate>()
  let reorderTimer: ReturnType<typeof setTimeout> | null = null

  async function executeReorder(updates: ReorderNoteUpdate[]) {
    await useRequest({
      key: `${NOTES_KEYS.REORDER_NOTES}:${Date.now()}`,
      fn: db => db.notes.reorder({ tripId: tripId.value, updates }),
      onError: () => {
        useToast().error('Ошибка при перемещении файлов')
        fetchNotes() // При ошибке синхронизируем с сервером
      },
    })
  }

  function applyListUpdate(parentId: string | null, newNodes: NoteTreeNode[]): void {
    if (readonly.value)
      return
    const updates: ReorderNoteUpdate[] = []

    // 1. Применяем изменения к локальному стейту мгновенно (Optimistic UI)
    newNodes.forEach((node, index) => {
      const target = notes.value.find(n => n.id === node.id)
      if (target) {
        if (target.parentId !== parentId || target.order !== index) {
          target.parentId = parentId
          target.order = index
          updates.push({ id: target.id, parentId, order: index })
          pendingReorders.set(target.id, { id: target.id, parentId, order: index })
        }
      }
    })

    // 2. Дебаунс отправки на сервер (собирает пачку изменений из разных папок)
    if (updates.length > 0) {
      if (reorderTimer)
        clearTimeout(reorderTimer)
      reorderTimer = setTimeout(() => {
        const toSend = [...pendingReorders.values()]
        pendingReorders.clear()
        if (toSend.length > 0)
          executeReorder(toSend)
      }, 500)
    }
  }

  return {
    notes,
    notesTree,
    flatFiles,
    activeNoteId,
    activeNote,
    imageUsage,
    sortMode,
    isLoading: isNotesLoading,
    isSaving,
    isUpdating,
    saveStatus,
    fetchNotes,
    fetchImagesUsage,
    createNote,
    updateNote,
    saveContent,
    flushPendingSave,
    deleteNote,
    applyListUpdate,
  }
}
