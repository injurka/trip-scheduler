import type { CalculateLayoutOptions, CentralSpineHub, LayoutEdge, LayoutNode, LayoutResult } from './types'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { PADDING_X, PADDING_Y } from './constants'
import { computeEdgeBase } from './edges'
import { estimateColumnNodeWidth, estimateNodeHeight } from './measure'

const GAP_Y = 32
const SPINE_OFFSET_X = 54

/** CENTRAL COLUMN LAYOUT: cards on both sides of a vertical spine, sized to fit their titles. */
export function computeColumnLayout(items: IActivity[], options: CalculateLayoutOptions): LayoutResult {
  const sized = items.map((activity, index) => {
    const width = estimateColumnNodeWidth(activity)
    return {
      activity,
      index,
      width,
      height: estimateNodeHeight(activity, width, Boolean(options.isEditMode)),
      isLeft: index % 2 === 0,
    }
  })

  const maxLeftWidth = Math.max(0, ...sized.filter(s => s.isLeft).map(s => s.width))
  const maxRightWidth = Math.max(0, ...sized.filter(s => !s.isLeft).map(s => s.width))
  const spineX = PADDING_X + maxLeftWidth + SPINE_OFFSET_X

  const spineHubs: CentralSpineHub[] = []
  let cursorY = PADDING_Y

  const nodes: LayoutNode[] = sized.map((s) => {
    const node: LayoutNode = {
      activity: s.activity,
      index: s.index,
      x: s.isLeft ? PADDING_X : spineX + SPINE_OFFSET_X,
      y: cursorY,
      width: s.width,
      height: s.height,
      isLeftToRight: s.isLeft,
    }
    spineHubs.push({
      x: spineX,
      y: node.y + node.height / 2,
      index: s.index,
      color: 'var(--fg-accent-color)',
    })
    cursorY += s.height + GAP_Y
    return node
  })

  // Continuous vertical spine track
  const spinePathD = nodes.length > 0
    ? `M ${spineX} ${nodes[0].y + nodes[0].height / 2} L ${spineX} ${nodes[nodes.length - 1].y + nodes[nodes.length - 1].height / 2}`
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

    edges.push({
      ...base,
      pathD,
      midX: spineX,
      midY: (fromHubY + toHubY) / 2,
    })
  }

  const totalWidth = PADDING_X * 2 + maxLeftWidth + SPINE_OFFSET_X * 2 + maxRightWidth + 50
  const totalHeight = cursorY - GAP_Y + PADDING_Y + 50

  return { nodes, edges, totalWidth, totalHeight, decorators: { spineHubs, spinePathD } }
}
