import type { LayoutEdge, LayoutNode } from './types'
import type { ActivitySectionBus, ActivitySectionMetro } from '~/shared/types/models/activity'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'

/** Shared edge metadata: color, dash style, gap duration and the ride behind the transition. */
export function computeEdgeBase(fromNode: LayoutNode, toNode: LayoutNode, index: number): Omit<LayoutEdge, 'pathD' | 'midX' | 'midY'> {
  const from = fromNode.activity
  const to = toNode.activity
  const fromMetro = from.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
  const toMetro = to.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
  const metroRide = fromMetro?.rides?.[0] || toMetro?.rides?.[0] || null

  const fromBus = from.sections?.find(s => s.type === EActivitySectionType.BUS) as ActivitySectionBus | undefined
  const toBus = to.sections?.find(s => s.type === EActivitySectionType.BUS) as ActivitySectionBus | undefined
  const busRide = fromBus?.rides?.[0] || toBus?.rides?.[0] || null

  const isWalk = from.tag === EActivityTag.WALK || to.tag === EActivityTag.WALK
  const color = metroRide?.lineColor || busRide?.color || (isWalk ? '#10B981' : 'var(--fg-accent-color)')
  const isDashed = isWalk

  const fromEndMin = timeToMinutes(from.endTime)
  const toStartMin = timeToMinutes(to.startTime)
  const gap = toStartMin - fromEndMin

  let durationText: string | null = null
  if (gap > 0) {
    if (gap < 60)
      durationText = `${gap}м`
    else durationText = `${Math.floor(gap / 60)}ч ${gap % 60}м`
  }
  else if (gap < 0) {
    durationText = 'Пересечение'
  }

  return {
    id: `edge-${from.id}-${to.id}`,
    fromIndex: index,
    toIndex: index + 1,
    fromActivity: from,
    toActivity: to,
    color,
    isDashed,
    metroRide,
    busRide,
    durationText,
    gapMinutes: gap,
  }
}
