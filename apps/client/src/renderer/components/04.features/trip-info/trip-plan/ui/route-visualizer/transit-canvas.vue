<script setup lang="ts">
import type { ITransitEdgeInfo } from './transit-edge-dialog.vue'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro, EActivityStatus, MetroRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { useElementSize } from '@vueuse/core'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'
import ActivityPreviewDialog from './activity-preview-dialog.vue'
import TransitEdgeDialog from './transit-edge-dialog.vue'
import TransitNodeCard from './transit-node-card.vue'

interface Props {
  activities: IActivity[]
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
})

const emit = defineEmits<{
  (e: 'selectActivity', activityId: string): void
  (e: 'editActivity', activity: IActivity): void
  (e: 'deleteActivity', activityId: string): void
  (e: 'toggleStatus', payload: { activity: IActivity, status: EActivityStatus }): void
  (e: 'moveActivity', payload: { activity: IActivity, direction: 'up' | 'down' }): void
  (e: 'addActivity', payload?: { startTime?: string, endTime?: string }): void
}>()

const viewportRef = ref<HTMLElement | null>(null)
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportRef)

// Pan & Zoom state
const scale = ref(1)
const translateX = ref(40)
const translateY = ref(40)
const isDragging = ref(false)
const dragStart = { x: 0, y: 0 }
const initialTranslate = { x: 0, y: 0 }

// Touch pinch zoom state
let initialPinchDistance = 0
let initialPinchScale = 1
let pinchMidpoint = { x: 0, y: 0 }

// Selected Node / Dialog State
const selectedActivityId = ref<string | null>(null)
const selectedActivity = ref<IActivity | null>(null)
const isActivityPreviewVisible = ref(false)

// Edge Dialog State
const isEdgeDialogVisible = ref(false)
const selectedEdgeInfo = ref<ITransitEdgeInfo | null>(null)

// Layout Constants
const NODE_WIDTH = 240
const NODE_HEIGHT = 72
const GAP_X = 75
const GAP_Y = 80
const PADDING_X = 45
const PADDING_Y = 45

interface LayoutNode {
  activity: IActivity
  index: number
  x: number
  y: number
  width: number
  height: number
  row: number
  col: number
  isLeftToRight: boolean
}

interface LayoutEdge {
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

function handleSelectActivityCard(activity: IActivity) {
  selectedActivityId.value = activity.id
  selectedActivity.value = activity
  isActivityPreviewVisible.value = true
}

function handleEdgeClick(edge: LayoutEdge) {
  selectedEdgeInfo.value = {
    id: edge.id,
    fromActivity: edge.fromActivity,
    toActivity: edge.toActivity,
    gapMinutes: edge.gapMinutes,
    durationText: edge.durationText,
    metroRide: edge.metroRide,
    color: edge.color,
    isDashed: edge.isDashed,
  }
  isEdgeDialogVisible.value = true
}

function handleInsertFromEdge(payload: { startTime: string, endTime: string }) {
  emit('addActivity', payload)
}

function handleToggleStatus(payload: { activity: IActivity, status: EActivityStatus }) {
  emit('toggleStatus', payload)
  if (selectedActivity.value?.id === payload.activity.id) {
    selectedActivity.value = { ...selectedActivity.value, status: payload.status }
  }
}

// Serpentine layout computation
const computedLayout = computed(() => {
  const items = props.activities
  if (!items || items.length === 0) {
    return { nodes: [], edges: [], totalWidth: 400, totalHeight: 300 }
  }

  // 3 nodes per row creates a balanced serpentine flow
  const colCount = Math.min(Math.max(items.length, 1), 3)

  const nodes: LayoutNode[] = []

  items.forEach((activity, index) => {
    const row = Math.floor(index / colCount)
    const isLeftToRight = row % 2 === 0
    const colInRow = index % colCount
    const col = isLeftToRight ? colInRow : colCount - 1 - colInRow

    const x = PADDING_X + col * (NODE_WIDTH + GAP_X)
    const y = PADDING_Y + row * (NODE_HEIGHT + GAP_Y)

    nodes.push({
      activity,
      index,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      row,
      col,
      isLeftToRight,
    })
  })

  // Compute connecting edges between consecutive nodes
  const edges: LayoutEdge[] = []

  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]

    // Metro & duration info
    const fromMetro = from.activity.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
    const toMetro = to.activity.sections?.find(s => s.type === EActivitySectionType.METRO) as ActivitySectionMetro | undefined
    const metroRide = fromMetro?.rides?.[0] || toMetro?.rides?.[0] || null

    const isWalk = from.activity.tag === EActivityTag.WALK || to.activity.tag === EActivityTag.WALK
    const color = metroRide?.lineColor || (isWalk ? '#10B981' : 'var(--fg-accent-color)')
    const isDashed = isWalk

    const fromEndMin = timeToMinutes(from.activity.endTime)
    const toStartMin = timeToMinutes(to.activity.startTime)
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

    let pathD = ''
    let midX = 0
    let midY = 0

    const fromCenterY = from.y + from.height / 2
    const toCenterY = to.y + to.height / 2

    if (from.row === to.row) {
      // Same row straight horizontal line
      if (from.isLeftToRight) {
        const startX = from.x + from.width
        const endX = to.x
        pathD = `M ${startX} ${fromCenterY} L ${endX} ${toCenterY}`
        midX = (startX + endX) / 2
        midY = fromCenterY
      }
      else {
        const startX = from.x
        const endX = to.x + to.width
        pathD = `M ${startX} ${fromCenterY} L ${endX} ${toCenterY}`
        midX = (startX + endX) / 2
        midY = fromCenterY
      }
    }
    else {
      // Smooth U-turn curve between rows
      const curveOffset = 55
      if (from.isLeftToRight) {
        // Curve on the right side
        const startX = from.x + from.width
        const endX = to.x + to.width
        pathD = `M ${startX} ${fromCenterY} C ${startX + curveOffset} ${fromCenterY}, ${endX + curveOffset} ${toCenterY}, ${endX} ${toCenterY}`
        midX = Math.max(startX, endX) + curveOffset * 0.72
        midY = (fromCenterY + toCenterY) / 2
      }
      else {
        // Curve on the left side
        const startX = from.x
        const endX = to.x
        pathD = `M ${startX} ${fromCenterY} C ${startX - curveOffset} ${fromCenterY}, ${endX - curveOffset} ${toCenterY}, ${endX} ${toCenterY}`
        midX = Math.min(startX, endX) - curveOffset * 0.72
        midY = (fromCenterY + toCenterY) / 2
      }
    }

    edges.push({
      id: `edge-${from.activity.id}-${to.activity.id}`,
      fromIndex: i,
      toIndex: i + 1,
      fromActivity: from.activity,
      toActivity: to.activity,
      pathD,
      midX,
      midY,
      color,
      isDashed,
      metroRide,
      durationText,
      gapMinutes: gap,
    })
  }

  // Calculate total bounding size
  const maxCol = Math.min(items.length, colCount)
  const totalRows = Math.ceil(items.length / colCount)
  const totalWidth = PADDING_X * 2 + maxCol * (NODE_WIDTH + GAP_X) + 60
  const totalHeight = PADDING_Y * 2 + totalRows * (NODE_HEIGHT + GAP_Y) + 50

  return { nodes, edges, totalWidth, totalHeight }
})

// Fit To View: automatically centers & scales the content
function fitToView() {
  const { totalWidth, totalHeight } = computedLayout.value
  const vWidth = viewportWidth.value || 800
  const vHeight = viewportHeight.value || 400

  if (totalWidth <= 0 || totalHeight <= 0 || vWidth <= 0 || vHeight <= 0)
    return

  const padding = 50
  const scaleX = (vWidth - padding) / totalWidth
  const scaleY = (vHeight - padding) / totalHeight
  const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.1)

  scale.value = targetScale
  translateX.value = (vWidth - totalWidth * targetScale) / 2
  translateY.value = (vHeight - totalHeight * targetScale) / 2
}

function resetZoom() {
  scale.value = 1
  const vWidth = viewportWidth.value || 800
  const vHeight = viewportHeight.value || 400
  const { totalWidth, totalHeight } = computedLayout.value
  translateX.value = (vWidth - totalWidth) / 2
  translateY.value = (vHeight - totalHeight) / 2
}

function zoomIn() {
  zoomAtCenter(1.2)
}

function zoomOut() {
  zoomAtCenter(0.833)
}

function zoomAtCenter(factor: number) {
  const newScale = Math.min(Math.max(scale.value * factor, 0.4), 2.2)
  const vWidth = viewportWidth.value || 800
  const vHeight = viewportHeight.value || 400
  const centerX = vWidth / 2
  const centerY = vHeight / 2

  translateX.value = centerX - (centerX - translateX.value) * (newScale / scale.value)
  translateY.value = centerY - (centerY - translateY.value) * (newScale / scale.value)
  scale.value = newScale
}

// Pointer Events (Pan)
function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0)
    return

  const target = e.target as HTMLElement
  if (target.closest('button, input, textarea, .action-btn, .transit-node-card')) {
    return
  }

  isDragging.value = true
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  initialTranslate.x = translateX.value
  initialTranslate.y = translateY.value

  if (viewportRef.value) {
    viewportRef.value.setPointerCapture(e.pointerId)
  }
}

function handlePointerMove(e: PointerEvent) {
  if (!isDragging.value)
    return
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  translateX.value = initialTranslate.x + dx
  translateY.value = initialTranslate.y + dy
}

function handlePointerUp(e: PointerEvent) {
  if (isDragging.value) {
    isDragging.value = false
    try {
      if (viewportRef.value?.hasPointerCapture(e.pointerId)) {
        viewportRef.value.releasePointerCapture(e.pointerId)
      }
    }
    catch {
      // ignore
    }
  }
}

// Wheel Zoom towards cursor
function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (!viewportRef.value)
    return

  const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
  const newScale = Math.min(Math.max(scale.value * zoomFactor, 0.4), 2.2)

  const rect = viewportRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  translateX.value = mouseX - (mouseX - translateX.value) * (newScale / scale.value)
  translateY.value = mouseY - (mouseY - translateY.value) * (newScale / scale.value)
  scale.value = newScale
}

// Touch gestures (Pinch to zoom)
function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    initialPinchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
    initialPinchScale = scale.value
    if (viewportRef.value) {
      const rect = viewportRef.value.getBoundingClientRect()
      pinchMidpoint = {
        x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
        y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      }
    }
  }
}

function handleTouchMove(e: TouchEvent) {
  if (e.touches.length === 2 && initialPinchDistance > 0) {
    e.preventDefault()
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
    const factor = currentDistance / initialPinchDistance
    const newScale = Math.min(Math.max(initialPinchScale * factor, 0.4), 2.2)

    translateX.value = pinchMidpoint.x - (pinchMidpoint.x - translateX.value) * (newScale / scale.value)
    translateY.value = pinchMidpoint.y - (pinchMidpoint.y - translateY.value) * (newScale / scale.value)
    scale.value = newScale
  }
}

watch([viewportWidth, viewportHeight], ([w, h]) => {
  if (w > 0 && h > 0 && props.activities.length > 0) {
    fitToView()
  }
}, { immediate: true })

watch(() => props.activities.length, () => {
  nextTick(() => {
    fitToView()
  })
})

onMounted(() => {
  nextTick(() => {
    fitToView()
  })
})

defineExpose({
  fitToView,
  resetZoom,
  zoomIn,
  zoomOut,
})
</script>

<template>
  <div
    ref="viewportRef"
    class="transit-canvas-viewport"
    :class="{ 'is-grabbing': isDragging }"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
    @wheel="handleWheel"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
  >
    <!-- Background Grid Pattern -->
    <div class="canvas-grid-pattern" />

    <!-- Transformed Canvas Content Area -->
    <div
      class="transit-canvas-stage"
      :style="{
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin: '0 0',
      }"
    >
      <!-- SVG Vector Transit Tracks Layer -->
      <svg
        class="transit-svg-layer"
        :width="computedLayout.totalWidth"
        :height="computedLayout.totalHeight"
      >
        <!-- Base Background Track (Solid track base) -->
        <path
          v-for="edge in computedLayout.edges"
          :key="`bg-${edge.id}`"
          :d="edge.pathD"
          class="track-path-base"
        />

        <!-- Colored Foreground Track with Click Interaction -->
        <path
          v-for="edge in computedLayout.edges"
          :key="`fg-${edge.id}`"
          :d="edge.pathD"
          class="track-path-line"
          :class="{ 'is-dashed': edge.isDashed }"
          :stroke="edge.color"
          @click.stop="handleEdgeClick(edge)"
        >
          <title>{{ edge.metroRide ? `${edge.metroRide.lineName} (${edge.durationText || ''})` : `Переход: ${edge.durationText || '0м'}` }}</title>
        </path>

        <!-- Continuous Smooth Flowing Stream along tracks -->
        <path
          v-for="edge in computedLayout.edges"
          :key="`flow-${edge.id}`"
          :d="edge.pathD"
          class="track-path-flow-stream"
          :stroke="edge.color"
        />
      </svg>

      <!-- Station Node Cards Layer -->
      <div
        v-for="node in computedLayout.nodes"
        :key="node.activity.id"
        class="transit-node-positioner"
        :style="{
          transform: `translate(${node.x}px, ${node.y}px)`,
        }"
      >
        <TransitNodeCard
          :activity="node.activity"
          :index="node.index"
          :is-first="node.index === 0"
          :is-last="node.index === computedLayout.nodes.length - 1"
          :is-edit-mode="isEditMode"
          :is-selected="selectedActivityId === node.activity.id"
          @select="handleSelectActivityCard"
          @edit="emit('editActivity', $event)"
          @delete="emit('deleteActivity', $event)"
          @toggle-status="handleToggleStatus"
          @move-up="emit('moveActivity', { activity: node.activity, direction: 'up' })"
          @move-down="emit('moveActivity', { activity: node.activity, direction: 'down' })"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="activities.length === 0" class="canvas-empty-state">
      <Icon icon="mdi:map-marker-path" class="empty-icon" />
      <p class="empty-title">
        На этот день пока нет запланированных остановок
      </p>
      <button v-if="isEditMode" class="empty-add-btn" @click="emit('addActivity')">
        <Icon icon="mdi:plus" />
        Добавить остановку
      </button>
    </div>

    <!-- Floating Canvas Controls Overlay -->
    <div class="canvas-floating-controls">
      <KitTooltip text="Приблизить (+)">
        <button class="canvas-tool-btn" @click="zoomIn">
          <Icon icon="mdi:plus" />
        </button>
      </KitTooltip>
      <KitTooltip text="Отдалить (-)">
        <button class="canvas-tool-btn" @click="zoomOut">
          <Icon icon="mdi:minus" />
        </button>
      </KitTooltip>
      <KitTooltip text="Вписать маршрут в экран (Fit)">
        <button class="canvas-tool-btn" @click="fitToView">
          <Icon icon="mdi:fit-to-screen-outline" />
        </button>
      </KitTooltip>
      <KitTooltip text="Масштаб 100%">
        <button class="canvas-tool-btn reset-btn" @click="resetZoom">
          {{ Math.round(scale * 100) }}%
        </button>
      </KitTooltip>
    </div>

    <!-- Floating Canvas Hint -->
    <div class="canvas-bottom-hint">
      <Icon icon="mdi:gesture-swipe" class="hint-icon" />
      <span>Кликните на карточку или линию для деталей</span>
    </div>

    <!-- Interactive Edge Details Dialog -->
    <TransitEdgeDialog
      v-if="isEdgeDialogVisible"
      v-model:visible="isEdgeDialogVisible"
      :edge-info="selectedEdgeInfo"
      :is-edit-mode="isEditMode"
      @insert-activity="handleInsertFromEdge"
      @scroll-to-activity="emit('selectActivity', $event)"
    />

    <!-- Interactive Node Activity Detail Preview Dialog -->
    <ActivityPreviewDialog
      v-if="isActivityPreviewVisible"
      v-model:visible="isActivityPreviewVisible"
      :activity="selectedActivity"
      :is-edit-mode="isEditMode"
      @edit="emit('editActivity', $event)"
      @delete="emit('deleteActivity', $event)"
      @toggle-status="handleToggleStatus"
      @scroll-to-activity="emit('selectActivity', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.transit-canvas-viewport {
  position: relative;
  width: 100%;
  height: 380px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  user-select: none;
  cursor: grab;
  touch-action: none;

  &.is-grabbing {
    cursor: grabbing;
  }

  @include media-down(sm) {
    height: 320px;
  }
}

.canvas-grid-pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(var(--border-secondary-color) 1.2px, transparent 1.2px);
  background-size: 20px 20px;
  opacity: 0.65;
}

.transit-canvas-stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
}

.transit-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}

.track-path-base {
  fill: none;
  stroke: var(--bg-tertiary-color);
  stroke-width: 8px;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.9;
}

.track-path-line {
  fill: none;
  stroke-width: 5px;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: stroke;
  cursor: pointer;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
  transition:
    stroke-width 0.2s ease,
    filter 0.2s ease;

  &:hover {
    stroke-width: 7px;
    filter: drop-shadow(0 0 8px currentColor);
  }

  &.is-dashed {
    stroke-dasharray: 8 6;
  }
}

.track-path-flow-stream {
  fill: none;
  stroke-width: 2px;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 8 16;
  stroke-dashoffset: 0;
  animation: transitFlowDash 1.8s linear infinite;
  opacity: 0.65;
  pointer-events: none;
  filter: drop-shadow(0 0 4px #ffffff);
}

@keyframes transitFlowDash {
  from {
    stroke-dashoffset: 48;
  }
  to {
    stroke-dashoffset: 0;
  }
}

.transit-node-positioner {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.canvas-floating-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 3px;
  box-shadow: var(--s-m);
  backdrop-filter: blur(8px);
}

.canvas-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-xs);
  background: transparent;
  border: none;
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.05rem;
  transition: all 0.15s ease;

  &:hover {
    color: var(--fg-primary-color);
    background: var(--bg-hover-color);
  }

  &.reset-btn {
    width: auto;
    padding: 0 6px;
    font-size: 0.72rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
}

.canvas-bottom-hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--bg-primary-color-rgb, 20, 20, 20), 0.65);
  border: 1px solid var(--border-secondary-color);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.7rem;
  color: var(--fg-tertiary-color);
  pointer-events: none;
  backdrop-filter: blur(6px);

  .hint-icon {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }

  @include media-down(sm) {
    display: none;
  }
}

.canvas-empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 24px;
  pointer-events: auto;

  .empty-icon {
    font-size: 2.8rem;
    color: var(--fg-tertiary-color);
    opacity: 0.6;
  }

  .empty-title {
    font-size: 0.92rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .empty-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--r-s);
    background: var(--fg-accent-color);
    color: #fff;
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease;

    &:hover {
      transform: scale(1.05);
    }
  }
}
</style>
