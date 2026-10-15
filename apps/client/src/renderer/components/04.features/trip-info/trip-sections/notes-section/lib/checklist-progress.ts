import type { TripNote } from '~/shared/services/api/model/types'

export interface MarkdownChecklistTask {
  noteId: string
  noteTitle: string
  lineIndex: number
  text: string
  completed: boolean
}

const TASK_LINE = /^([\t ]*(?:[-+*]|\d+[.)])[\t ]+\[)([ x])\](.*)$/i

function findFolderScope(notes: TripNote[], currentNoteId: string | null): { folderId: string, title: string } | null {
  const currentNote = notes.find(note => note.id === currentNoteId)
  if (!currentNote)
    return null

  if (currentNote.type === 'folder')
    return { folderId: currentNote.id, title: currentNote.title }

  const parent = notes.find(note => note.id === currentNote.parentId && note.type === 'folder')
  return parent ? { folderId: parent.id, title: parent.title } : null
}

export function getChecklistScope(notes: TripNote[], currentNoteId: string | null): {
  files: TripNote[]
  folderTitle: string | null
} {
  const folder = findFolderScope(notes, currentNoteId)
  if (!folder) {
    return {
      files: notes.filter(note => note.type === 'markdown'),
      folderTitle: null,
    }
  }

  const folderIds = new Set([folder.folderId])
  let foldersAdded = true

  while (foldersAdded) {
    foldersAdded = false
    for (const note of notes) {
      if (note.type === 'folder' && note.parentId && folderIds.has(note.parentId) && !folderIds.has(note.id)) {
        folderIds.add(note.id)
        foldersAdded = true
      }
    }
  }

  return {
    files: notes.filter(note => note.type === 'markdown' && note.parentId && folderIds.has(note.parentId)),
    folderTitle: folder.title,
  }
}

export function parseMarkdownChecklistTasks(note: TripNote): MarkdownChecklistTask[] {
  if (note.type !== 'markdown' || !note.content)
    return []

  const lines = note.content.split(/\r?\n/)
  const tasks: MarkdownChecklistTask[] = []
  let fence: { marker: '`' | '~', length: number } | null = null

  lines.forEach((line, lineIndex) => {
    if (fence) {
      const closingFence = /^[\t ]*(`{3,}|~{3,})[\t ]*$/.exec(line)
      if (closingFence?.[1]?.[0] === fence.marker && closingFence[1].length >= fence.length) {
        fence = null
      }
      return
    }

    const openingFence = /^[\t ]*(`{3,}|~{3,})/.exec(line)
    if (openingFence) {
      fence = {
        marker: openingFence[1]![0] as '`' | '~',
        length: openingFence[1]!.length,
      }
      return
    }

    const match = TASK_LINE.exec(line)
    if (!match)
      return

    tasks.push({
      noteId: note.id,
      noteTitle: note.title,
      lineIndex,
      text: match[3]!.trim() || '(задача без названия)',
      completed: match[2]!.toLowerCase() === 'x',
    })
  })

  return tasks
}

export function toggleMarkdownChecklistTask(content: string | null, lineIndex: number): string | null {
  if (content == null)
    return content

  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)
  const line = lines[lineIndex]
  if (line == null)
    return content

  const match = TASK_LINE.exec(line)
  if (!match)
    return content

  const nextMark = match[2]!.toLowerCase() === 'x' ? ' ' : 'x'
  lines[lineIndex] = `${match[1]}${nextMark}]${match[3]}`
  return lines.join(newline)
}
