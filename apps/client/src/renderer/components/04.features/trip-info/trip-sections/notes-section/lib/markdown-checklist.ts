import type { TripNote } from '~/shared/services/api/model/types'

export interface MarkdownChecklistTask {
  noteId: string
  noteTitle: string
  lineIndex: number
  indent: number
  parentLineIndex: number | null
  text: string
  completed: boolean
}

const TASK_LINE = /^([\t ]*(?:[-+*]|\d+[.)])[\t ]+\[)([ x])\](.*)$/i

interface Fence {
  marker: '`' | '~'
  length: number
}

function getOpeningFence(line: string): Fence | null {
  const match = /^[\t ]*(`{3,}|~{3,})/.exec(line)

  if (!match)
    return null

  return {
    marker: match[1]![0] as '`' | '~',
    length: match[1]!.length,
  }
}

function isClosingFence(line: string, fence: Fence): boolean {
  const match = /^[\t ]*(`{3,}|~{3,})[\t ]*$/.exec(line)

  return match?.[1]?.[0] === fence.marker && match[1].length >= fence.length
}

function appendTaskFromLine(
  line: string,
  lineIndex: number,
  note: TripNote,
  tasks: MarkdownChecklistTask[],
  parents: Array<{ indent: number, lineIndex: number }>,
) {
  const match = TASK_LINE.exec(line)

  if (!match)
    return

  const listItem = /^[\t ]*(?:[-+*]|\d+[.)])/.exec(line)
  const indentation = listItem?.[0].match(/^[\t ]*/)?.[0] ?? ''
  const indent = [...indentation].reduce((size, character) => size + (character === '\t' ? 4 : 1), 0)

  while (parents.length && parents.at(-1)!.indent >= indent)
    parents.pop()

  tasks.push({
    noteId: note.id,
    noteTitle: note.title,
    lineIndex,
    indent,
    parentLineIndex: parents.at(-1)?.lineIndex ?? null,
    text: match[3]!.trim() || '(задача без названия)',
    completed: match[2]!.toLowerCase() === 'x',
  })
  parents.push({ indent, lineIndex })
}

export function parseMarkdownChecklistTasks(note: TripNote): MarkdownChecklistTask[] {
  if (note.type !== 'markdown' || !note.content)
    return []

  const lines = note.content.split(/\r?\n/)
  const tasks: MarkdownChecklistTask[] = []
  const parents: Array<{ indent: number, lineIndex: number }> = []
  let fence: Fence | null = null

  lines.forEach((line, lineIndex) => {
    if (fence) {
      if (isClosingFence(line, fence))
        fence = null

      return
    }

    const openingFence = getOpeningFence(line)

    if (openingFence) {
      fence = openingFence

      return
    }

    appendTaskFromLine(
      line,
      lineIndex,
      note,
      tasks,
      parents,
    )
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
