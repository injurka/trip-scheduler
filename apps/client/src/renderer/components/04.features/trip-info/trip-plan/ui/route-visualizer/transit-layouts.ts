import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro, MetroRide } from '~/shared/types/models/activity'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityStatus, EActivityTag } from '~/shared/types/models/activity'

export type TransitLayoutMode
  = | 'phases' // Фазы дня
    | 'column' // Вертикальная ось
    | 'trail' // Извилистая тропа
    | 'radial' // Суточный циферблат

export interface ILayoutOption {
  id: TransitLayoutMode
  label: string
  icon: string
  tooltip: string
}

export const TRANSIT_LAYOUT_OPTIONS: ILayoutOption[] = [
  { id: 'phases', label: 'Фазы дня', icon: 'mdi:view-column-outline', tooltip: 'Зонирование: Утро / День / Вечер' },
  { id: 'column', label: 'Ось', icon: 'mdi:source-commit', tooltip: 'Двусторонняя центральная ось' },
  { id: 'trail', label: 'Тропа', icon: 'mdi:sine-wave', tooltip: 'Плавная извилистая тропа' },
  { id: 'radial', label: 'Циферблат', icon: 'mdi:circle-slice-8', tooltip: 'Суточный циферблат по кругу' },
]

export interface LayoutNode {
  activity: IActivity
  index: number
  x: number
  y: number
  width: number
  height: number
  row?: number
  col?: number
  isLeftToRight?: boolean
}

export interface LayoutEdge {
  id: string
  fromIndex: number
  toIndex: number
  fromActivity: IActivity
  toActivity: IActivity
  pathD: string
  midX: number
  midY: number
  color: string
  isDashed: boolean
  metroRide: MetroRide | null
  durationText: string | null
  gapMinutes: number
}

export interface PhaseContainer {
  id: 'morning' | 'afternoon' | 'evening'
  title: string
  icon: string
  timeSpan: string
  x: number
  y: number
  width: number
  height: number
  count: number
}

export interface CentralSpineHub {
  x: number
  y: number
  index: number
  color: string
}

export interface RadialCenterHub {
  cx: number
  cy: number
  radius: number
  totalCount: number
  completedCount: number
  timeSpan: string
}

export interface LayoutDecorators {
  phaseContainers?: PhaseContainer[]
  spineHubs?: CentralSpineHub[]
  spinePathD?: string
  radialHub?: RadialCenterHub
  radialRingD?: string
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  totalWidth: number
  totalHeight: number
  decorators: LayoutDecorators
}

const NODE_WIDTH = 240
const NODE_HEIGHT = 72
const PADDING_X = 45
const PADDING_Y = 45

function computeEdgeBase(fromNode: LayoutNode, toNode: LayoutNode, index: number) {
  const from = fromNode.activity
  const to = toNode.activity
  const fromMetro = from.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
  const toMetro = to.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
  const metroRide = fromMetro?.rides?.[0] || toMetro?.rides?.[0] || null

  const isWalk = from.tag === EActivityTag.WALK || to.tag === EActivityTag.WALK
  const color = metroRide?.lineColor || (isWalk ? '#10B981' : 'var(--fg-accent-color)')
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
    durationText,
    gapMinutes: gap,
  }
}

/** 2. SCENIC WINDING TRAIL LAYOUT */
function computeTrailLayout(items: IActivity[]): LayoutResult {
  const colCount = Math.min(Math.max(items.length, 1), 3)
  const GAP_X = 80
  const ROW_HEIGHT = NODE_HEIGHT + 95

  const nodes: LayoutNode[] = items.map((activity, index) => {
    const row = Math.floor(index / colCount)
    const isLeftToRight = row % 2 === 0
    const colInRow = index % colCount
    const col = isLeftToRight ? colInRow : colCount - 1 - colInRow

    // Harmonic wave vertical oscillation
    const waveOffset = Math.sin((index * 1.5)) * 28
    const x = PADDING_X + col * (NODE_WIDTH + GAP_X)
    const y = PADDING_Y + 25 + row * ROW_HEIGHT + waveOffset

    return {
      activity,
      index,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      row,
      col,
      isLeftToRight,
    }
  })

  const edges: LayoutEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const base = computeEdgeBase(from, to, i)

    const fromCenterY = from.y + from.height / 2
    const toCenterY = to.y + to.height / 2

    let pathD = ''
    let midX = 0
    let midY = 0

    if (from.row === to.row) {
      if (from.isLeftToRight) {
        const startX = from.x + from.width
        const endX = to.x
        const c1X = startX + (endX - startX) * 0.5
        const c1Y = fromCenterY - 18
        const c2X = startX + (endX - startX) * 0.5
        const c2Y = toCenterY + 18
        pathD = `M ${startX} ${fromCenterY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${toCenterY}`
        midX = (startX + endX) / 2
        midY = (fromCenterY + toCenterY) / 2
      }
      else {
        const startX = from.x
        const endX = to.x + to.width
        const c1X = startX - (startX - endX) * 0.5
        const c1Y = fromCenterY + 18
        const c2X = startX - (startX - endX) * 0.5
        const c2Y = toCenterY - 18
        pathD = `M ${startX} ${fromCenterY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${toCenterY}`
        midX = (startX + endX) / 2
        midY = (fromCenterY + toCenterY) / 2
      }
    }
    else {
      const curveOffset = 65
      if (from.isLeftToRight) {
        const startX = from.x + from.width
        const endX = to.x + to.width
        pathD = `M ${startX} ${fromCenterY} C ${startX + curveOffset} ${fromCenterY + 10}, ${endX + curveOffset} ${toCenterY - 10}, ${endX} ${toCenterY}`
        midX = Math.max(startX, endX) + curveOffset * 0.75
        midY = (fromCenterY + toCenterY) / 2
      }
      else {
        const startX = from.x
        const endX = to.x
        pathD = `M ${startX} ${fromCenterY} C ${startX - curveOffset} ${fromCenterY + 10}, ${endX - curveOffset} ${toCenterY - 10}, ${endX} ${toCenterY}`
        midX = Math.min(startX, endX) - curveOffset * 0.75
        midY = (fromCenterY + toCenterY) / 2
      }
    }

    edges.push({ ...base, pathD, midX, midY })
  }

  const maxCol = Math.min(items.length, colCount)
  const totalRows = Math.ceil(items.length / colCount)
  const totalWidth = PADDING_X * 2 + maxCol * (NODE_WIDTH + GAP_X) + 60
  const totalHeight = PADDING_Y * 2 + totalRows * ROW_HEIGHT + 60

  return { nodes, edges, totalWidth, totalHeight, decorators: {} }
}

/** 4. DAY PHASES LAYOUT (Morning / Afternoon / Evening) */
function computePhasesLayout(items: IActivity[]): LayoutResult {
  const PHASE_COL_WIDTH = NODE_WIDTH + 32
  const GAP_PHASE = 56
  const HEADER_OFFSET = 55
  const NODE_GAP_Y = 30

  const morningItems: { activity: IActivity, index: number }[] = []
  const afternoonItems: { activity: IActivity, index: number }[] = []
  const eveningItems: { activity: IActivity, index: number }[] = []

  items.forEach((activity, index) => {
    const startMin = timeToMinutes(activity.startTime)
    if (Number.isNaN(startMin) || startMin < 12 * 60) {
      morningItems.push({ activity, index })
    }
    else if (startMin < 17 * 60) {
      afternoonItems.push({ activity, index })
    }
    else {
      eveningItems.push({ activity, index })
    }
  })

  const phaseBuckets = [
    { id: 'morning' as const, title: 'Утро', icon: 'mdi:weather-sunset-up', timeSpan: 'до 12:00', items: morningItems },
    { id: 'afternoon' as const, title: 'День', icon: 'mdi:white-balance-sunny', timeSpan: '12:00 – 17:00', items: afternoonItems },
    { id: 'evening' as const, title: 'Вечер', icon: 'mdi:weather-night', timeSpan: 'после 17:00', items: eveningItems },
  ]

  const maxItemsInPhase = Math.max(morningItems.length, afternoonItems.length, eveningItems.length, 1)
  const phaseHeight = HEADER_OFFSET + maxItemsInPhase * (NODE_HEIGHT + NODE_GAP_Y) + 24

  const phaseContainers: PhaseContainer[] = []
  const nodesMap = new Map<number, LayoutNode>()

  phaseBuckets.forEach((bucket, pIdx) => {
    const phaseX = PADDING_X + pIdx * (PHASE_COL_WIDTH + GAP_PHASE)
    const phaseY = PADDING_Y

    phaseContainers.push({
      id: bucket.id,
      title: bucket.title,
      icon: bucket.icon,
      timeSpan: bucket.timeSpan,
      x: phaseX,
      y: phaseY,
      width: PHASE_COL_WIDTH,
      height: phaseHeight,
      count: bucket.items.length,
    })

    bucket.items.forEach((item, itemIdx) => {
      const nodeX = phaseX + 16
      const nodeY = phaseY + HEADER_OFFSET + itemIdx * (NODE_HEIGHT + NODE_GAP_Y)
      nodesMap.set(item.index, {
        activity: item.activity,
        index: item.index,
        x: nodeX,
        y: nodeY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        col: pIdx,
        row: itemIdx,
      })
    })
  })

  const nodes: LayoutNode[] = items.map((_, i) => nodesMap.get(i)!).filter(Boolean)

  const edges: LayoutEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const base = computeEdgeBase(from, to, i)

    let pathD = ''
    let midX = 0
    let midY = 0

    if (from.col === to.col) {
      // Same phase vertical connection
      const startX = from.x + from.width / 2
      const startY = from.y + from.height
      const endX = to.x + to.width / 2
      const endY = to.y
      pathD = `M ${startX} ${startY} L ${endX} ${endY}`
      midX = startX
      midY = (startY + endY) / 2
    }
    else {
      // Inter-phase bridge
      const startX = from.x + from.width
      const startY = from.y + from.height / 2
      const endX = to.x
      const endY = to.y + to.height / 2
      const dx = Math.max(25, (endX - startX) * 0.5)
      pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`
      midX = (startX + endX) / 2
      midY = (startY + endY) / 2
    }

    edges.push({ ...base, pathD, midX, midY })
  }

  const totalWidth = PADDING_X * 2 + 3 * PHASE_COL_WIDTH + 2 * GAP_PHASE + 40
  const totalHeight = PADDING_Y * 2 + phaseHeight + 40

  return { nodes, edges, totalWidth, totalHeight, decorators: { phaseContainers } }
}

/** 5. CENTRAL COLUMN LAYOUT (Subway Spine) */
function computeColumnLayout(items: IActivity[]): LayoutResult {
  const GAP_Y = 32
  const SPINE_OFFSET_X = 54
  const spineX = PADDING_X + NODE_WIDTH + SPINE_OFFSET_X

  const spineHubs: CentralSpineHub[] = []

  const nodes: LayoutNode[] = items.map((activity, index) => {
    const isLeft = index % 2 === 0
    const x = isLeft ? PADDING_X : spineX + SPINE_OFFSET_X
    const y = PADDING_Y + index * (NODE_HEIGHT + GAP_Y)
    const centerY = y + NODE_HEIGHT / 2

    spineHubs.push({
      x: spineX,
      y: centerY,
      index,
      color: 'var(--fg-accent-color)',
    })

    return {
      activity,
      index,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      isLeftToRight: isLeft,
    }
  })

  // Continuous vertical spine track
  const spinePathD = nodes.length > 0
    ? `M ${spineX} ${nodes[0].y + NODE_HEIGHT / 2} L ${spineX} ${nodes[nodes.length - 1].y + NODE_HEIGHT / 2}`
    : ''

  const edges: LayoutEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const base = computeEdgeBase(from, to, i)

    const fromHubY = from.y + from.height / 2
    const toHubY = to.y + to.height / 2

    const fromCardX = from.isLeftToRight ? from.x + from.width : from.x
    const toCardX = to.isLeftToRight ? to.x + to.width : to.x

    // Path: from card -> spine -> down spine -> to next card
    const pathD = `M ${fromCardX} ${fromHubY} L ${spineX} ${fromHubY} L ${spineX} ${toHubY} L ${toCardX} ${toHubY}`
    const midX = spineX
    const midY = (fromHubY + toHubY) / 2

    edges.push({ ...base, pathD, midX, midY })
  }

  const totalWidth = PADDING_X * 2 + NODE_WIDTH * 2 + SPINE_OFFSET_X * 2 + 50
  const totalHeight = PADDING_Y * 2 + items.length * (NODE_HEIGHT + GAP_Y) + 50

  return { nodes, edges, totalWidth, totalHeight, decorators: { spineHubs, spinePathD } }
}

/** 6. RADIAL CLOCK / RADAR LAYOUT (Spacious collision-free geometry) */
function computeRadialLayout(items: IActivity[]): LayoutResult {
  const totalCount = Math.max(items.length, 1)
  // Distance along circumference needed per node is at least 330px to prevent card overlaps
  const radius = Math.max(380, Math.ceil((totalCount * 330) / (2 * Math.PI)))
  const cx = PADDING_X + radius + NODE_WIDTH / 2 + 40
  const cy = PADDING_Y + radius + NODE_HEIGHT / 2 + 40

  const nodes: LayoutNode[] = items.map((activity, index) => {
    // Distribute evenly clockwise starting at 12 o'clock (-PI / 2)
    const angle = (index / totalCount) * 2 * Math.PI - Math.PI / 2
    const nodeCenterX = cx + radius * Math.cos(angle)
    const nodeCenterY = cy + radius * Math.sin(angle)

    return {
      activity,
      index,
      x: nodeCenterX - NODE_WIDTH / 2,
      y: nodeCenterY - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  })

  const edges: LayoutEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    const base = computeEdgeBase(from, to, i)

    const fromAngle = (i / totalCount) * 2 * Math.PI - Math.PI / 2
    const toAngle = ((i + 1) / totalCount) * 2 * Math.PI - Math.PI / 2

    const fromX = cx + radius * Math.cos(fromAngle)
    const fromY = cy + radius * Math.sin(fromAngle)
    const toX = cx + radius * Math.cos(toAngle)
    const toY = cy + radius * Math.sin(toAngle)

    const midAngle = (fromAngle + toAngle) / 2
    const midX = cx + radius * Math.cos(midAngle)
    const midY = cy + radius * Math.sin(midAngle)

    // Circular Arc Path
    const pathD = `M ${fromX} ${fromY} A ${radius} ${radius} 0 0 1 ${toX} ${toY}`
    edges.push({ ...base, pathD, midX, midY })
  }

  // Radial Hub Summary Info
  const completedCount = items.filter(a => a.status === EActivityStatus.COMPLETED).length
  const timeSpan = items.length > 0 ? `${items[0].startTime} – ${items[items.length - 1].endTime}` : '00:00'

  const radialRingD = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`

  const totalWidth = (radius + NODE_WIDTH / 2 + PADDING_X + 40) * 2
  const totalHeight = (radius + NODE_HEIGHT / 2 + PADDING_Y + 40) * 2

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
    },
  }
}

/** Master Layout Dispatcher */
export function calculateTransitLayout(mode: TransitLayoutMode, items: IActivity[]): LayoutResult {
  if (!items || items.length === 0) {
    return {
      nodes: [],
      edges: [],
      totalWidth: 500,
      totalHeight: 350,
      decorators: {},
    }
  }

  switch (mode) {
    case 'phases':
      return computePhasesLayout(items)
    case 'column':
      return computeColumnLayout(items)
    case 'trail':
      return computeTrailLayout(items)
    case 'radial':
      return computeRadialLayout(items)
    default:
      return computePhasesLayout(items)
  }
}
