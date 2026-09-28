import type { CalculateLayoutOptions, ILayoutOption, LayoutResult, TransitLayoutMode } from './types'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import { computeColumnLayout } from './column'
import { computePhasesLayout } from './phases'
import { computeRadialLayout } from './radial'

export { PHASE_CARD_MIN_HEIGHT } from './phases'
export * from './types'

export const TRANSIT_LAYOUT_OPTIONS: ILayoutOption[] = [
  { id: 'phases', label: 'Фазы дня', icon: 'mdi:view-column-outline', tooltip: 'Зонирование: Утро / День / Вечер' },
  { id: 'column', label: 'Ось', icon: 'mdi:source-commit', tooltip: 'Двусторонняя центральная ось' },
  { id: 'radial', label: 'Циферблат', icon: 'mdi:circle-slice-8', tooltip: 'Суточный циферблат по кругу' },
]

/** Master Layout Dispatcher */
export function calculateTransitLayout(
  mode: TransitLayoutMode,
  items: IActivity[],
  options: CalculateLayoutOptions = {},
): LayoutResult {
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
      return computePhasesLayout(items, options)
    case 'column':
      return computeColumnLayout(items, options)
    case 'radial':
      return computeRadialLayout(items, options)
    default:
      return computePhasesLayout(items, options)
  }
}
