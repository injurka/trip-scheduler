import type { TimelineGroup } from '../types'
import type { Memory } from '~/shared/types/models/memory'

export function groupMemories(memoriesList: Memory[]): TimelineGroup[] {
  if (!memoriesList.length)
    return []

  const groups: TimelineGroup[] = []
  let currentGroup: TimelineGroup | null = null

  const ensureStartGroup = (): TimelineGroup => {
    let startGroup = groups.find(g => g.type === 'start')

    if (!startGroup) {
      startGroup = { type: 'start', title: '', memories: [], activity: null }
      groups.unshift(startGroup)
    }

    return startGroup
  }

  const activityIds = new Set(memoriesList.filter(m => m.title).map(m => m.id))
  const linked = memoriesList.filter(m => !m.title && m.parentMemoryId && activityIds.has(m.parentMemoryId))
  const linkedIds = new Set(linked.map(m => m.id))

  for (const memory of memoriesList.filter(m => !linkedIds.has(m.id))) {
    if (memory.title) {
      currentGroup = { type: 'activity', activity: memory, title: memory.title, memories: [] }

      if (memory.imageId || memory.comment)
        currentGroup.memories.push(memory)

      groups.push(currentGroup)
    }
    else if (currentGroup) {
      currentGroup.memories.push(memory)
    }
    else {
      ensureStartGroup().memories.push(memory)
    }
  }

  for (const memory of linked) {
    groups.find(g => g.activity?.id === memory.parentMemoryId)!.memories.push(memory)
  }

  for (const group of groups) {
    group.memories.sort((a, b) => {
      if (a.id === group.activity?.id)
        return -1

      if (b.id === group.activity?.id)
        return 1

      return (a.timestamp ?? '').localeCompare(b.timestamp ?? '')
    })
  }

  return groups
}
