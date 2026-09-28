import type { CalculateLayoutOptions, LayoutEdge, LayoutNode, LayoutResult, RadialTick } from './types'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivityStatus } from '~/shared/types/models/activity'
import { NODE_HEIGHT, NODE_WIDTH, PADDING_X, PADDING_Y } from './constants'
import { computeEdgeBase } from './edges'
import { estimateNodeHeight } from './measure'

/** Minimum arc gap between adjacent card edges on the dial (px). */
const ARC_GAP = 14
/** Cards never shrink below this scale, even when activities almost overlap in time. */
const MIN_SCALE = 0.25
/** Hour labels are drawn this far beyond the outer card edge. */
const LABEL_GAP = 26
/** Sanity cap for the ring stagger so inner cards never reach the hub. */
const MAX_STAGGER = 160

interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
}

function boxesIntersect(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
}

/**
 * RADIAL CLOCK LAYOUT: a real 24-hour dial — activities sit at the angle of
 * their actual time of day (00:00 at 12 o'clock, clockwise).
 *
 * Overlap control has two coupled mechanisms:
 * 1. Cards alternate between an outer and an inner ring (even/odd index), so
 *    time-adjacent cards are radially separated. The ring offset is found by
 *    binary search over the actual (axis-aligned) card boxes, so it is exact
 *    regardless of where the pair sits on the dial.
 * 2. Cards sharing a ring are spaced by a uniform scale factor — all cards
 *    shrink together, keeping proportions, until they fit.
 * The two interact (a bigger stagger shrinks the inner ring's arc), so they
 * are iterated to a fixed point, and a final all-pairs overlap check shrinks
 * the scale further if anything still collides.
 */
export function computeRadialLayout(items: IActivity[], options: CalculateLayoutOptions): LayoutResult {
  const totalCount = Math.max(items.length, 1)
  const radius = 380

  const nodeHeights = items.map(activity => estimateNodeHeight(activity, NODE_WIDTH, Boolean(options.isEditMode)))
  const maxNodeHeight = Math.max(NODE_HEIGHT, ...nodeHeights)

  const cx = PADDING_X + radius + NODE_WIDTH / 2 + 40
  const cy = PADDING_Y + radius + maxNodeHeight / 2 + 40

  // Angle of every activity on the 24h dial: midpoint of its time range.
  const angles = items.map((activity) => {
    const start = timeToMinutes(activity.startTime)
    const end = timeToMinutes(activity.endTime)
    const mid = Number.isNaN(start) ? 0 : (Number.isFinite(end) && end > start ? (start + end) / 2 : start)
    return ((mid % 1440) / 1440) * 2 * Math.PI - Math.PI / 2
  })

  /** Clockwise angular gap from item i to item j (j may wrap past midnight). */
  const angleGapBetween = (i: number, j: number): number => {
    let gap = angles[j] - angles[i]
    if (j < i)
      gap += 2 * Math.PI
    if (gap < 0)
      gap += 2 * Math.PI
    return gap
  }

  /** Axis-aligned visual box of card i at the given ring stagger and scale. */
  const boxOf = (i: number, stagger: number, scale: number): Box => {
    const ringRadius = radius + (i % 2 === 0 ? stagger : -stagger)
    const centerX = cx + ringRadius * Math.cos(angles[i])
    const centerY = cy + ringRadius * Math.sin(angles[i])
    const halfW = (NODE_WIDTH * scale) / 2
    const halfH = (nodeHeights[i] * scale) / 2
    return { x1: centerX - halfW, y1: centerY - halfH, x2: centerX + halfW, y2: centerY + halfH }
  }

  /** Minimal ring stagger that separates the given pair at the given scale. */
  const pairStagger = (i: number, j: number, scale: number): number => {
    if (!boxesIntersect(boxOf(i, 0, scale), boxOf(j, 0, scale)))
      return 0
    let lo = 0
    let hi = MAX_STAGGER
    for (let iter = 0; iter < 24; iter++) {
      const mid = (lo + hi) / 2
      if (boxesIntersect(boxOf(i, mid, scale), boxOf(j, mid, scale)))
        lo = mid
      else
        hi = mid
    }
    return hi
  }

  /** Max stagger over every time-adjacent (cross-ring) pair. */
  const computeStagger = (scale: number): number => {
    if (totalCount < 2)
      return 0
    let maxStagger = 0
    for (let i = 0; i < totalCount - 1; i++)
      maxStagger = Math.max(maxStagger, pairStagger(i, i + 1, scale))
    maxStagger = Math.max(maxStagger, pairStagger(totalCount - 1, 0, scale))
    return maxStagger
  }

  /** Scale that fits same-ring neighbors on the (smaller) inner ring. */
  const computeScale = (stagger: number): number => {
    const innerRadius = radius - stagger
    let minScale = Number.POSITIVE_INFINITY
    for (const parity of [0, 1]) {
      const indices = items.map((_, i) => i).filter(i => i % 2 === parity)
      if (indices.length < 2)
        continue
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k]
        const j = indices[(k + 1) % indices.length]
        const available = angleGapBetween(i, j) * innerRadius - ARC_GAP
        minScale = Math.min(minScale, available / NODE_WIDTH)
      }
    }
    return Math.min(1, Math.max(MIN_SCALE, minScale))
  }

  const hasAnyOverlap = (stagger: number, scale: number): boolean => {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (boxesIntersect(boxOf(i, stagger, scale), boxOf(j, stagger, scale)))
          return true
      }
    }
    return false
  }

  // Fixed-point iteration (values only ever shrink, so it converges safely).
  let scale = 1
  let stagger = 0
  for (let iter = 0; iter < 8; iter++) {
    scale = Math.min(scale, computeScale(stagger))
    stagger = computeStagger(scale)
  }

  // Final guarantee: shrink further until no pair collides (pathological
  // same-minute clusters may still touch at the absolute floor).
  for (let safety = 0; safety < 12 && hasAnyOverlap(stagger, scale); safety++) {
    scale = Math.max(0.12, scale * 0.85)
    stagger = computeStagger(scale)
  }

  const nodes: LayoutNode[] = items.map((activity, index) => {
    const ringRadius = radius + (index % 2 === 0 ? stagger : -stagger)
    const nodeCenterX = cx + ringRadius * Math.cos(angles[index])
    const nodeCenterY = cy + ringRadius * Math.sin(angles[index])

    return {
      activity,
      index,
      // Positioned so the scaled card's center lands exactly on its ring.
      x: nodeCenterX - (NODE_WIDTH * scale) / 2,
      y: nodeCenterY - (nodeHeights[index] * scale) / 2,
      width: NODE_WIDTH,
      height: nodeHeights[index],
      scale,
    }
  })

  const edges: LayoutEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const base = computeEdgeBase(from, to, i)

    const fromX = cx + radius * Math.cos(angles[i])
    const fromY = cy + radius * Math.sin(angles[i])
    const toX = cx + radius * Math.cos(angles[i + 1])
    const toY = cy + radius * Math.sin(angles[i + 1])

    const midAngle = (angles[i] + angles[i + 1]) / 2
    const midX = cx + radius * Math.cos(midAngle)
    const midY = cy + radius * Math.sin(midAngle)

    // Circular Arc Path along the base ring
    const pathD = `M ${fromX} ${fromY} A ${radius} ${radius} 0 0 1 ${toX} ${toY}`
    edges.push({ ...base, pathD, midX, midY })
  }

  // Hour tick marks (every hour) + labels every 3 hours, 00:00 at the top.
  // Labels sit beyond the outer card edge so cards never cover them.
  const labelRadius = radius + stagger + (maxNodeHeight * scale) / 2 + LABEL_GAP
  const hourTicks: RadialTick[] = []
  for (let h = 0; h < 24; h++) {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const label = h % 3 === 0 ? String(h).padStart(2, '0') : null
    hourTicks.push({
      x1: cx + cos * (radius - 8),
      y1: cy + sin * (radius - 8),
      x2: cx + cos * (radius + 8),
      y2: cy + sin * (radius + 8),
      label,
      labelX: label ? cx + cos * labelRadius : 0,
      labelY: label ? cy + sin * labelRadius : 0,
    })
  }

  // Radial Hub Summary Info
  const completedCount = items.filter(a => a.status === EActivityStatus.COMPLETED).length
  const timeSpan = items.length > 0 ? `${items[0].startTime} – ${items[items.length - 1].endTime}` : '00:00'

  const radialRingD = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`

  const totalWidth = (cx + labelRadius) * 2
  const totalHeight = (cy + labelRadius) * 2

  return {
    nodes,
    edges,
    totalWidth,
    totalHeight,
    decorators: {
      radialHub: {
        cx,
        cy,
        radius: 80,
        totalCount: items.length,
        completedCount,
        timeSpan,
      },
      radialRingD,
      radialTicks: hourTicks,
    },
  }
}
