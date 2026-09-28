import type { CalculateLayoutOptions, LayoutEdge, LayoutNode, LayoutResult, PhaseContainer } from './types'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { timeToMinutes } from '~/shared/lib/date-time'
import { NODE_HEIGHT, NODE_WIDTH, PADDING_X, PADDING_Y } from './constants'
import { computeEdgeBase } from './edges'
import { estimateNodeHeight } from './measure'

/** «Фазы дня» показывает блоки крупнее остальных раскладок: +25% к габаритам карточки. */
const PHASES_CARD_SCALE = 1.25
const PHASE_NODE_WIDTH = Math.round(NODE_WIDTH * PHASES_CARD_SCALE)
/** Минимальная высота блока «Фаз дня» — прокидывается в карточку (min-height), 72 × 1.25. */
export const PHASE_CARD_MIN_HEIGHT = Math.round(NODE_HEIGHT * PHASES_CARD_SCALE)
const PHASE_COL_WIDTH = PHASE_NODE_WIDTH + 32
const GAP_PHASE = 56
const HEADER_OFFSET = 64
const NODE_GAP_Y = 50

interface PhaseBucket {
  id: 'morning' | 'afternoon' | 'evening'
  title: string
  icon: string
  timeSpan: string
  items: { activity: IActivity, index: number }[]
}

/** DAY PHASES LAYOUT: independent columns for Morning / Afternoon / Evening. */
export function computePhasesLayout(items: IActivity[], options: CalculateLayoutOptions): LayoutResult {
  const morningItems: PhaseBucket['items'] = []
  const afternoonItems: PhaseBucket['items'] = []
  const eveningItems: PhaseBucket['items'] = []

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

  const phaseBuckets: PhaseBucket[] = [
    { id: 'morning', title: 'Утро', icon: 'mdi:weather-sunset-up', timeSpan: 'до 12:00', items: morningItems },
    { id: 'afternoon', title: 'День', icon: 'mdi:white-balance-sunny', timeSpan: '12:00 – 17:00', items: afternoonItems },
    { id: 'evening', title: 'Вечер', icon: 'mdi:weather-night', timeSpan: 'после 17:00', items: eveningItems },
  ]

  const phaseContainers: PhaseContainer[] = []
  const nodesMap = new Map<number, LayoutNode>()

  phaseBuckets.forEach((bucket, pIdx) => {
    const phaseX = PADDING_X + pIdx * (PHASE_COL_WIDTH + GAP_PHASE)
    const phaseY = PADDING_Y
    let cursorY = phaseY + HEADER_OFFSET

    bucket.items.forEach((item, itemIdx) => {
      // Резервируем реальную высоту карточки (её content-box или min-height), иначе колонка
      // получает лишний воздух и автоподгонка канваса делает блоки мельче на экране.
      const estimate = estimateNodeHeight(item.activity, PHASE_NODE_WIDTH, Boolean(options.isEditMode))
      const nodeHeight = Math.max(estimate, PHASE_CARD_MIN_HEIGHT)
      nodesMap.set(item.index, {
        activity: item.activity,
        index: item.index,
        x: phaseX + 16,
        y: cursorY,
        width: PHASE_NODE_WIDTH,
        height: nodeHeight,
        col: pIdx,
        row: itemIdx,
      })
      cursorY += nodeHeight + NODE_GAP_Y
    })

    phaseContainers.push({
      id: bucket.id,
      title: bucket.title,
      icon: bucket.icon,
      timeSpan: bucket.timeSpan,
      x: phaseX,
      y: phaseY,
      width: PHASE_COL_WIDTH,
      // Real column height: header + sum of card heights + gaps + bottom padding
      height: cursorY - phaseY - NODE_GAP_Y + 24,
      count: bucket.items.length,
    })
  })

  const nodes: LayoutNode[] = items.map((_, i) => nodesMap.get(i)!).filter(Boolean)

  const edges: LayoutEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]

    // Phases are independent columns: no bridge from the last card of one
    // phase to the first card of the next — links only run inside a column.
    if (from.col !== to.col)
      continue

    const base = computeEdgeBase(from, to, i)
    const startX = from.x + from.width / 2
    const startY = from.y + from.height
    const endX = to.x + to.width / 2
    const endY = to.y
    const pathD = `M ${startX} ${startY} L ${endX} ${endY}`

    edges.push({
      ...base,
      pathD,
      midX: startX,
      midY: (startY + endY) / 2,
    })
  }

  const totalWidth = PADDING_X * 2 + 3 * PHASE_COL_WIDTH + 2 * GAP_PHASE + 40
  const tallestPhase = Math.max(...phaseContainers.map(c => c.height), 0)
  const totalHeight = PADDING_Y * 2 + tallestPhase + 40

  return { nodes, edges, totalWidth, totalHeight, decorators: { phaseContainers } }
}
