import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { BusRide, MetroRide } from '~/shared/types/models/activity'

export type TransitLayoutMode
  = | 'phases' // Фазы дня
    | 'column' // Вертикальная ось
    | 'radial' // Суточный циферблат

export interface ILayoutOption {
  id: TransitLayoutMode
  label: string
  icon: string
  tooltip: string
}

export interface CalculateLayoutOptions {
  isEditMode?: boolean
}

export interface LayoutNode {
  activity: IActivity
  index: number
  x: number
  y: number
  width: number
  height: number
  /** Visual scale factor applied to the card (radial layout shrinks cards to fit the dial). */
  scale?: number
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
  busRide?: BusRide | null
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

export interface RadialTick {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string | null
  labelX: number
  labelY: number
}

export interface LayoutDecorators {
  phaseContainers?: PhaseContainer[]
  spineHubs?: CentralSpineHub[]
  spinePathD?: string
  radialHub?: RadialCenterHub
  radialRingD?: string
  radialTicks?: RadialTick[]
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  totalWidth: number
  totalHeight: number
  decorators: LayoutDecorators
}
