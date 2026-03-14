import type { NoteImageUsage, NoteType, ReorderNoteUpdate, TripNote } from '~/shared/services/api/model/types'
import { useStorage } from '@vueuse/core'
import { useRequest, useRequestStatus } from '~/plugins/request'

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
    if (match[1]) {
      ids.add(match[1].toLowerCase())
    }
  }

  return Array.from(ids)
}

export function useNotesSection(tripId: string, readonly: boolean) {
  const notes = ref<TripNote[]>([])
  const imageUsage = ref<NoteImageUsage[]>([])
  const activeNoteId = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('saved')
  const sortMode = useStorage<SortMode>(`notes:sort:${tripId}`, 'manual')

  const isNotesLoading = useRequestStatus(NOTES_KEYS.FETCH_NOTES)
  const isSaving = useRequestStatus(NOTES_KEYS.CREATE_NOTE)
  const isUpdating = useRequestStatus(NOTES_KEYS.UPDATE_NOTE)

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
        // Папки всегда сверху
        if (a.type === 'folder' && b.type !== 'folder')
          return -1
        if (a.type !== 'folder' && b.type === 'folder')
          return 1

        // Применяем выбранную сортировку
        if (sortMode.value === 'name') {
          return a.title.localeCompare(b.title)
        }
        if (sortMode.value === 'date') {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime()
          const dateB = new Date(b.updatedAt || b.createdAt).getTime()
          return dateB - dateA // Новые измененные сверху
        }

        // По умолчанию (вручную)
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
      fn: db => db.notes.getByTripId(tripId),
      onSuccess: (data) => {
        notes.value = data ?? []
      },
      onError: ({ error }) => {
        useToast().error(`Не удалось загрузить заметки: ${error.customMessage}`)
      },
    })
  }

  async function fetchImagesUsage(): Promise<void> {
    await useRequest({
      key: NOTES_KEYS.FETCH_IMAGES,
      fn: db => db.notes.getImagesUsage(tripId),
      onSuccess: (data) => {
        imageUsage.value = data ?? []
      },
    })
  }

  async function createNote(data: {
    title: string
    type: NoteType
    parentId: string | null
  }): Promise<void> {
    if (readonly)
      return

    const siblings = notes.value.filter(n => n.parentId === data.parentId)
    const order = siblings.length > 0
      ? Math.max(...siblings.map(s => s.order)) + 1
      : 0

    await useRequest({
      key: NOTES_KEYS.CREATE_NOTE,
      fn: db => db.notes.create({ tripId, ...data, order }),
      onSuccess: (newNote) => {
        if (!newNote)
          return
        notes.value.push(newNote)
        if (newNote.type !== 'folder') {
          activeNoteId.value = newNote.id
        }
      },
      onError: ({ error }) => {
        useToast().error(`Ошибка при создании: ${error.customMessage}`)
      },
    })
  }

  async function updateNote(
    id: string,
    data: { title?: string, content?: string | null, parentId?: string | null, color?: string | null },
  ): Promise<void> {
    if (readonly)
      return

    const index = notes.value.findIndex(n => n.id === id)
    const backup = index !== -1 ? { ...notes.value[index]! } : null

    if (index !== -1) {
      notes.value[index] = { ...notes.value[index]!, ...data }
    }

    const imageIds = data.content !== undefined
      ? parseImageIds(data.content)
      : undefined

    await useRequest({
      key: NOTES_KEYS.UPDATE_NOTE,
      fn: db => db.notes.update({ id, ...data, imageIds }),
      onSuccess: (updated) => {
        if (updated && index !== -1) {
          notes.value[index] = updated
        }
        saveStatus.value = 'saved'
      },
      onError: ({ error }) => {
        saveStatus.value = 'error'
        useToast().error(`Ошибка при обновлении: ${error.customMessage}`)
        if (backup && index !== -1)
          notes.value[index] = backup
        if (data.parentId !== undefined)
          fetchNotes()
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
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }

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
    if (readonly)
      return

    const isConfirmed = await useConfirm()({
      title: 'Удалить?',
      description: 'Файл или папка со всем содержимым будет удалена навсегда.',
      type: 'danger',
    })
    if (!isConfirmed)
      return

    await useRequest({
      key: NOTES_KEYS.DELETE_NOTE,
      fn: db => db.notes.delete(id),
      onSuccess: () => {
        if (activeNoteId.value === id)
          activeNoteId.value = null

        const toRemove = new Set<string>()
        const collectDescendants = (noteId: string): void => {
          toRemove.add(noteId)
          notes.value
            .filter(n => n.parentId === noteId)
            .forEach(n => collectDescendants(n.id))
        }
        collectDescendants(id)
        notes.value = notes.value.filter(n => !toRemove.has(n.id))
      },
      onError: ({ error }) => {
        useToast().error(`Ошибка при удалении: ${error.customMessage}`)
      },
    })
  }

  async function reorderNotes(updates: ReorderNoteUpdate[]): Promise<void> {
    if (readonly || updates.length === 0)
      return

    const backups = updates
      .map((u) => {
        const note = notes.value.find(n => n.id === u.id)
        return note
          ? { id: u.id, parentId: note.parentId, order: note.order }
          : null
      })
      .filter((b): b is ReorderNoteUpdate => b !== null)

    for (const u of updates) {
      const note = notes.value.find(n => n.id === u.id)
      if (note) {
        note.parentId = u.parentId
        note.order = u.order
      }
    }

    await useRequest({
      key: NOTES_KEYS.REORDER_NOTES,
      fn: db => db.notes.reorder({ tripId, updates }),
      onError: () => {
        useToast().error('Ошибка при перемещении')
        for (const b of backups) {
          const note = notes.value.find(n => n.id === b.id)
          if (note) {
            note.parentId = b.parentId
            note.order = b.order
          }
        }
      },
    })
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
    reorderNotes,
  }
}
