interface ContextMemory {
  parentMemoryId?: string | null
  id: string
  title: string | null
  comment: string | null
  timestamp: Date | null
  tag: string | null
  tags: string[] | null
  imageId: string | null
  sourceActivityId: string | null
  plannedTitle: string | null
  plannedStart: string | null
  plannedEnd: string | null
}

/** Include the complete trip timeline; only selected-day records are editable. */
export function buildMemoryTimeline(memories: ContextMemory[], selectedDate: string) {
  return memories.map((memory) => {
    const timestamp = memory.timestamp?.toISOString()
    return {
      id: memory.id,
      parentMemoryId: memory.parentMemoryId ?? null,
      type: memory.imageId ? 'media' : memory.title ? 'activity' : 'note',
      title: memory.title,
      comment: memory.comment,
      date: timestamp?.slice(0, 10) ?? null,
      time: timestamp?.slice(11, 16) ?? null,
      editable: timestamp?.slice(0, 10) === selectedDate,
      tag: memory.tag,
      tags: memory.tags ?? [],
      sourceActivity: memory.sourceActivityId
        ? {
            id: memory.sourceActivityId,
            title: memory.plannedTitle,
            startTime: memory.plannedStart,
            endTime: memory.plannedEnd,
          }
        : null,
    }
  })
}
