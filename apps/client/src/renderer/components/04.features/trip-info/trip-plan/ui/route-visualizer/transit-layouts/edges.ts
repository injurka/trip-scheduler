import type { LayoutEdge, LayoutNode } from './types'
import type { ActivitySectionBus, ActivitySectionMetro } from '~/shared/types/models/activity'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'

/** Shared edge metadata: color, dash style, gap duration and the ride behind the transition. */
export function computeEdgeBase(fromNode: LayoutNode, toNode: LayoutNode, index: number): Omit<LayoutEdge, 'pathD' | 'midX' | 'midY'> {
  const from = fromNode.activity
  const to = toNode.activity
  const fromEndMin = timeToMinutes(from.endTime)
  const toStartMin = timeToMinutes(to.startTime)
  const gap = toStartMin - fromEndMin
  const metroRide = getMetroRide(from, to)
  const busRide = getBusRide(from, to)
  const isWalk = from.tag === EActivityTag.WALK || to.tag === EActivityTag.WALK

  return {
    id: `edge-${from.id}-${to.id}`,
    fromIndex: index,
    toIndex: index + 1,
    fromActivity: from,
    toActivity: to,
    color: metroRide?.lineColor || busRide?.color || getDefaultEdgeColor(isWalk),
    isDashed: isWalk,
    metroRide,
    busRide,
    durationText: formatGapDuration(gap),
    gapMinutes: gap,
  }
}

function getMetroRide(from: LayoutEdge['fromActivity'], to: LayoutEdge['toActivity']) {
  return getFirstMetroRide(from) || getFirstMetroRide(to) || null
}

function getFirstMetroRide(activity: LayoutEdge['fromActivity']): ActivitySectionMetro['rides'][number] | undefined {
  const section = activity.sections?.find(item => item.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined

  return section?.rides?.[0]
}

function getBusRide(from: LayoutEdge['fromActivity'], to: LayoutEdge['toActivity']) {
  return getFirstBusRide(from) || getFirstBusRide(to) || null
}

function getFirstBusRide(activity: LayoutEdge['fromActivity']): ActivitySectionBus['rides'][number] | undefined {
  const section = activity.sections?.find(item => item.type === EActivitySectionType.BUS) as ActivitySectionBus | undefined

  return section?.rides?.[0]
}

function getDefaultEdgeColor(isWalk: boolean): string {
  return isWalk ? '#10B981' : 'var(--fg-accent-color)'
}

function formatGapDuration(gap: number): string | null {
  if (gap < 0)
    return 'Пересечение'

  if (gap === 0)
    return null

  return gap < 60 ? `${gap}м` : `${Math.floor(gap / 60)}ч ${gap % 60}м`
}
