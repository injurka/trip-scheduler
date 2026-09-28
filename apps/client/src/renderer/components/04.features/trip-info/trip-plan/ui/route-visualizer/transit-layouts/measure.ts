import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionBus, ActivitySectionMetro } from '~/shared/types/models/activity'
import { EActivitySectionType } from '~/shared/types/models/activity'
import { NODE_HEIGHT, NODE_WIDTH } from './constants'

/** Horizontal inset of the card content: padding (12+12) + bullet (32) + gap (10). */
const CONTENT_INSET_X = 66
/** Approximate rendered height of a single title line (0.86rem × 1.35). */
const TITLE_LINE_HEIGHT = 19
/** Approximate rendered height of one metro/bus pill row (pill + row gap). */
const RIDE_ROW_HEIGHT = 22
/** Approximate height added by the edit-mode action bar. */
const EDIT_BAR_HEIGHT = 32
/** Max card width in the column layout — prevents absurd cards for very long titles. */
const MAX_COLUMN_NODE_WIDTH = 420
/** Fallback char width when canvas is unavailable (non-browser contexts). */
const FALLBACK_CHAR_WIDTH = 8

let measureContext: CanvasRenderingContext2D | null | undefined

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined')
    return null
  if (measureContext === undefined) {
    const canvas = document.createElement('canvas')
    measureContext = canvas.getContext('2d')
  }
  return measureContext
}

/** Measures the rendered width of a node card title (matches `.card-title`: 0.86rem / 600). */
export function measureTitleWidth(title: string): number {
  const ctx = getMeasureContext()
  if (!ctx)
    return title.length * FALLBACK_CHAR_WIDTH
  ctx.font = '600 14px system-ui, -apple-system, "Segoe UI", sans-serif'
  // ~6% safety margin so the estimate never undercuts the real render
  return Math.ceil(ctx.measureText(title).width * 1.06)
}

/** Estimated rendered card height, so layouts reserve real space instead of a fixed 72px. */
export function estimateNodeHeight(activity: IActivity, nodeWidth: number, isEditMode: boolean): number {
  const metro = activity.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
  const bus = activity.sections?.find(s => s.type === EActivitySectionType.BUS) as ActivitySectionBus | undefined
  const rideCount = (metro?.rides?.length || 0) + (bus?.rides?.length || 0)

  const title = activity.title || 'Остановка маршрута'
  const titleLines = measureTitleWidth(title) > nodeWidth - CONTENT_INSET_X ? 2 : 1

  let height = NODE_HEIGHT
  height += (titleLines - 1) * TITLE_LINE_HEIGHT
  if (rideCount > 0)
    height += rideCount * RIDE_ROW_HEIGHT + 2
  if (isEditMode)
    height += EDIT_BAR_HEIGHT
  return height
}

/** Card width for the column layout: wide enough to fit the title on a single line. */
export function estimateColumnNodeWidth(activity: IActivity): number {
  const title = activity.title || 'Остановка маршрута'
  const width = measureTitleWidth(title) + CONTENT_INSET_X + 8
  return Math.min(Math.max(width, NODE_WIDTH), MAX_COLUMN_NODE_WIDTH)
}
