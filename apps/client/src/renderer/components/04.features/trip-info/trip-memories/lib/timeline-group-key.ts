import type { TimelineGroup } from '../types'

export function getTimelineGroupKey(group: TimelineGroup): string {
  if (group.type === 'start')
    return 'group-start'

  return `group-activity-${group.activity?.id || group.title}`
}
