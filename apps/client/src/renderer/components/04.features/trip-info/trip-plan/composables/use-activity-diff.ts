import type { IActivity } from '../models/types'

export interface ActivityFieldDiff {
  field: string
  label: string
  original: string
  draft: string
  changed: boolean
}

export interface ActivityDiffResult {
  hasChanges: boolean
  changedFields: ActivityFieldDiff[]
  sectionsAdded: number
  sectionsRemoved: number
  sectionsModified: number
}

function stringify(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export function useActivityDiff(original: IActivity, draft: IActivity): ActivityDiffResult {
  const fields: ActivityFieldDiff[] = [
    {
      field: 'startTime',
      label: 'Начало',
      original: original.startTime ?? '—',
      draft: draft.startTime ?? '—',
      changed: original.startTime !== draft.startTime,
    },
    {
      field: 'endTime',
      label: 'Конец',
      original: original.endTime ?? '—',
      draft: draft.endTime ?? '—',
      changed: original.endTime !== draft.endTime,
    },
    {
      field: 'title',
      label: 'Название',
      original: original.title ?? '—',
      draft: draft.title ?? '—',
      changed: original.title !== draft.title,
    },
    {
      field: 'tag',
      label: 'Тег',
      original: original.tag ?? '—',
      draft: draft.tag ?? '—',
      changed: original.tag !== draft.tag,
    },
  ]

  const origSections = original.sections ?? []
  const draftSections = draft.sections ?? []
  const origIds = new Set(origSections.map(s => s.id))
  const draftIds = new Set(draftSections.map(s => s.id))

  const sectionsAdded = draftSections.filter(s => !origIds.has(s.id)).length
  const sectionsRemoved = origSections.filter(s => !draftIds.has(s.id)).length

  let sectionsModified = 0
  for (const draftSection of draftSections) {
    const origSection = origSections.find(s => s.id === draftSection.id)
    if (origSection && stringify(origSection) !== stringify(draftSection)) {
      sectionsModified++
    }
  }

  const changedFields = fields.filter(f => f.changed)
  const hasChanges = changedFields.length > 0 || sectionsAdded > 0 || sectionsRemoved > 0 || sectionsModified > 0

  return {
    hasChanges,
    changedFields,
    sectionsAdded,
    sectionsRemoved,
    sectionsModified,
  }
}
