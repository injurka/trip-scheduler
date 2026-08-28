<script setup lang="ts">
import type { ITransitEdgeInfo } from './transit-edge-dialog.vue'
import type { LayoutEdge, TransitLayoutMode } from './transit-layouts'
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro } from '~/shared/types/models/activity'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { useElementSize, useMediaQuery, useStorage } from '@vueuse/core'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { EActivitySectionType } from '~/shared/types/models/activity'
import ActivityPreviewDialog from './activity-preview-dialog.vue'
import TransitEdgeDialog from './transit-edge-dialog.vue'
import { calculateTransitLayout, TRANSIT_LAYOUT_OPTIONS } from './transit-layouts'
import TransitNodeCard from './transit-node-card.vue'

interface Props {
  activities: IActivity[]
  isEditMode?: boolean
  initialLayoutMode?: TransitLayoutMode
}

const props = withDefaults(defineProps<Props>(), {
  isEditMode: false,
})

const emit = defineEmits<{
  (e: 'selectActivity', activityId: string): void
  (e: 'editActivity', activity: IActivity): void
  (e: 'deleteActivity', activityId: string): void
  (e: 'moveActivity', payload: { activity: IActivity, direction: 'up' | 'down' }): void
  (e: 'addActivity', payload?: { startTime?: string, endTime?: string }): void
  (e: 'changeLayout', mode: TransitLayoutMode): void
}>()

const viewportRef = ref<HTMLElement | null>(null)
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportRef)

const validModes: TransitLayoutMode[] = ['serpentine', 'phases', 'column', 'trail', 'radial']
const rawLayoutMode = useStorage<string>(
  'transit_canvas_layout_mode',
  props.initialLayoutMode || 'serpentine',
)
if (!validModes.includes(rawLayoutMode.value as TransitLayoutMode)) {
  rawLayoutMode.value = 'serpentine'
}
const layoutMode = rawLayoutMode as Ref<TransitLayoutMode>

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

// Desktop Hover Tooltip State
const isDesktop = useMediaQuery('(min-width: 768px)')
const isHoverable = useMediaQuery('(hover: hover)')
const isDesktopHover = computed(() => isDesktop.value && isHoverable.value)

const hoveredActivity = ref<IActivity | null>(null)
const hoveredDescriptionModel = ref('')
const hoverReferenceRef = ref<HTMLElement | null>(null)
const hoverFloatingRef = ref<HTMLElement | null>(null)
const isHoverTooltipVisible = ref(false)

const { x: tooltipX, y: tooltipY, strategy: tooltipStrategy } = useFloating(
  hoverReferenceRef,
  hoverFloatingRef,
  {
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({ fallbackPlacements: ['bottom', 'right', 'left'] }),
      shift({ padding: 12 }),
    ],
    open: isHoverTooltipVisible,
  },
)

const hoverFloatingStyle = computed(() => {
  const isPos = tooltipX.value != null && tooltipY.value != null
  return {
    position: tooltipStrategy.value,
    top: isPos ? `${tooltipY.value}px` : '0',
    left: isPos ? `${tooltipX.value}px` : '0',
    visibility: isPos ? 'visible' as const : 'hidden' as const,
  }
})

let hoverShowTimer: ReturnType<typeof setTimeout> | null = null
let hoverHideTimer: ReturnType<typeof setTimeout> | null = null

function handleNodeMouseEnter(activity: IActivity, el: HTMLElement) {
  if (!isDesktopHover.value || isDragging.value || isActivityPreviewVisible.value)
    return

  if (hoverHideTimer) {
    clearTimeout(hoverHideTimer)
    hoverHideTimer = null
  }

  hoverReferenceRef.value = el
  hoveredActivity.value = activity

  const descSection = activity.sections?.find(
    s => s.type === EActivitySectionType.DESCRIPTION,
  ) as { text?: string } | undefined
  hoveredDescriptionModel.value = descSection?.text || activity.explanation || ''

  if (hoverShowTimer) {
    clearTimeout(hoverShowTimer)
  }
  hoverShowTimer = setTimeout(() => {
    if (!isDragging.value && !isActivityPreviewVisible.value) {
      isHoverTooltipVisible.value = true
    }
  }, 220)
}

function handleNodeMouseLeave() {
  if (hoverShowTimer) {
    clearTimeout(hoverShowTimer)
    hoverShowTimer = null
  }
  hoverHideTimer = setTimeout(() => {
    isHoverTooltipVisible.value = false
  }, 120)
}

function handleTooltipAfterLeave() {
  if (!isHoverTooltipVisible.value) {
    hoveredActivity.value = null
    hoveredDescriptionModel.value = ''
    hoverReferenceRef.value = null
  }
}

function clearHideTimer() {
  if (hoverHideTimer) {
    clearTimeout(hoverHideTimer)
    hoverHideTimer = null
  }
}

function handleTooltipMouseLeave() {
  handleNodeMouseLeave()
}

function getActivityMetroRides(activity: IActivity): ActivitySectionMetro['rides'] {
  const metroSection = activity.sections?.find(
    s => s.type === EActivitySectionType.METRO,
  ) as ActivitySectionMetro | undefined
  return metroSection?.rides || []
}

function handleSelectActivityCard(activity: IActivity) {
  isHoverTooltipVisible.value = false
  if (hoverShowTimer) {
    clearTimeout(hoverShowTimer)
  }
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

function handleSelectMode(mode: TransitLayoutMode) {
  if (layoutMode.value === mode)
    return

  layoutMode.value = mode
  emit('changeLayout', mode)

  nextTick(() => {
    fitToView()
  })
}

// Master Layout computation
const computedLayout = computed(() => {
  return calculateTransitLayout(layoutMode.value, props.activities)
})

// Fit To View: automatically centers & scales the content taking floating UI tabs into account
function fitToView() {
  const { totalWidth, totalHeight } = computedLayout.value
  const vWidth = viewportWidth.value || 800
  const vHeight = viewportHeight.value || 400

  if (totalWidth <= 0 || totalHeight <= 0 || vWidth <= 0 || vHeight <= 0)
    return

  const topOffset = props.activities.length > 0 ? 56 : 24
  const bottomOffset = 42
  const horizontalPadding = 48

  const availableWidth = Math.max(vWidth - horizontalPadding, 100)
  const availableHeight = Math.max(vHeight - topOffset - bottomOffset, 100)

  const scaleX = availableWidth / totalWidth
  const scaleY = availableHeight / totalHeight
  const targetScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.15)

  scale.value = targetScale
  translateX.value = (vWidth - totalWidth * targetScale) / 2
  translateY.value = topOffset + (availableHeight - totalHeight * targetScale) / 2
}

function resetZoom() {
  scale.value = 1
  const vWidth = viewportWidth.value || 800
  const vHeight = viewportHeight.value || 400
  const { totalWidth, totalHeight } = computedLayout.value

  const topOffset = props.activities.length > 0 ? 56 : 24
  const bottomOffset = 42
  const availableHeight = Math.max(vHeight - topOffset - bottomOffset, 100)

  translateX.value = (vWidth - totalWidth) / 2
  translateY.value = topOffset + (availableHeight - totalHeight) / 2
}

function zoomIn() {
  zoomAtCenter(1.2)
}

function zoomOut() {
  zoomAtCenter(0.833)
}

function zoomAtCenter(factor: number) {
  const newScale = Math.min(Math.max(scale.value * factor, 0.2), 2.5)
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

  if (isHoverTooltipVisible.value) {
    isHoverTooltipVisible.value = false
    if (hoverShowTimer) {
      clearTimeout(hoverShowTimer)
      hoverShowTimer = null
    }
  }

  const target = e.target as HTMLElement
  if (target.closest('button, input, textarea, .action-btn, .transit-node-card, .canvas-floating-tabs, .canvas-floating-controls')) {
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
  const newScale = Math.min(Math.max(scale.value * zoomFactor, 0.2), 2.5)

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
    const newScale = Math.min(Math.max(initialPinchScale * factor, 0.2), 2.5)

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
  setLayoutMode: handleSelectMode,
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
      <!-- Mode Specific Decorator HTML Layers -->
      <!-- 1. Day Phases Container Cards -->
      <div
        v-if="layoutMode === 'phases' && computedLayout.decorators.phaseContainers"
        :key="`phases-${layoutMode}`"
        class="phases-background-layer"
      >
        <div
          v-for="phase in computedLayout.decorators.phaseContainers"
          :key="phase.id"
          class="phase-container-card"
          :class="`phase--${phase.id}`"
          :style="{
            transform: `translate(${phase.x}px, ${phase.y}px)`,
            width: `${phase.width}px`,
            height: `${phase.height}px`,
          }"
        >
          <div class="phase-header">
            <div class="phase-icon-wrapper">
              <Icon :icon="phase.icon" class="phase-icon" />
            </div>
            <div class="phase-info">
              <span class="phase-title">{{ phase.title }}</span>
              <span class="phase-timespan">{{ phase.timeSpan }}</span>
            </div>
            <span class="phase-count-badge">{{ phase.count }}</span>
          </div>
        </div>
      </div>

      <!-- 2. Radial Center Hub Card -->
      <div
        v-if="layoutMode === 'radial' && computedLayout.decorators.radialHub"
        :key="`radial-${layoutMode}`"
        class="radial-center-hub"
        :style="{
          transform: `translate(${computedLayout.decorators.radialHub.cx}px, ${computedLayout.decorators.radialHub.cy}px) translate(-50%, -50%)`,
        }"
      >
        <div class="radial-hub-inner">
          <Icon icon="mdi:clock-time-eight-outline" class="hub-icon" />
          <div class="hub-progress">
            <span class="hub-total-num">{{ computedLayout.decorators.radialHub.totalCount }}</span>
          </div>
          <div class="hub-subtitle">
            остановок
          </div>
          <div class="hub-timespan">
            {{ computedLayout.decorators.radialHub.timeSpan }}
          </div>
        </div>
      </div>

      <!-- SVG Vector Transit Tracks Layer -->
      <svg
        :key="`svg-${layoutMode}`"
        class="transit-svg-layer"
        :width="computedLayout.totalWidth"
        :height="computedLayout.totalHeight"
      >

        <!-- Radial Mode: Orbit Ring Path -->
        <path
          v-if="layoutMode === 'radial' && computedLayout.decorators.radialRingD"
          :d="computedLayout.decorators.radialRingD"
          class="radial-orbit-ring"
        />

        <!-- Column Mode: Vertical Spine Track -->
        <path
          v-if="layoutMode === 'column' && computedLayout.decorators.spinePathD"
          :d="computedLayout.decorators.spinePathD"
          class="spine-track-line"
        />

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

        <!-- Edge Time Badges (Clickable interval pills on connectors) -->
        <template
          v-for="edge in computedLayout.edges"
          :key="`badge-${edge.id}`"
        >
          <g
            v-if="edge.durationText"
            class="edge-badge-group"
            @click.stop="handleEdgeClick(edge)"
          >
            <rect
              :x="edge.midX - 25"
              :y="edge.midY - 10"
              width="50"
              height="20"
              rx="10"
              class="edge-badge-bg"
              :stroke="edge.color"
            />
            <text
              :x="edge.midX"
              :y="edge.midY + 3.5"
              class="edge-badge-text"
              text-anchor="middle"
            >
              {{ edge.durationText }}
            </text>
          </g>
        </template>

        <!-- Column Mode: Spine Station Dots -->
        <g v-if="layoutMode === 'column' && computedLayout.decorators.spineHubs">
          <circle
            v-for="hub in computedLayout.decorators.spineHubs"
            :key="hub.index"
            :cx="hub.x"
            :cy="hub.y"
            r="6.5"
            class="spine-hub-dot"
            :fill="hub.color"
          />
        </g>
      </svg>

      <!-- Station Node Cards Layer -->
      <div
        v-for="node in computedLayout.nodes"
        :key="node.activity.id"
        class="transit-node-positioner"
        :style="{
          transform: `translate(${node.x}px, ${node.y}px)`,
          width: `${node.width}px`,
        }"
        @mouseenter="handleNodeMouseEnter(node.activity, $event.currentTarget as HTMLElement)"
        @mouseleave="handleNodeMouseLeave"
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

    <!-- Floating Layout Tabs Switcher Overlay (Top Left) -->
    <div v-if="activities.length > 0" class="canvas-floating-tabs" @pointerdown.stop>
      <KitTooltip
        v-for="option in TRANSIT_LAYOUT_OPTIONS"
        :key="option.id"
        :text="option.tooltip"
      >
        <button
          class="layout-tab-btn"
          :class="{ active: layoutMode === option.id }"
          @click="handleSelectMode(option.id)"
        >
          <Icon :icon="option.icon" class="tab-icon" />
          <span class="tab-label">{{ option.label }}</span>
        </button>
      </KitTooltip>
    </div>

    <!-- Floating Canvas Controls Overlay (Bottom Right) -->
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

    <!-- Floating Canvas Hint (Bottom Left) -->
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
      @scroll-to-activity="emit('selectActivity', $event)"
    />

    <!-- Desktop Hover Detail Tooltip -->
    <Teleport to="body">
      <Transition name="transit-tooltip-fade" @after-leave="handleTooltipAfterLeave">
        <div
          v-if="isHoverTooltipVisible && hoveredActivity && isDesktopHover && !isDragging"
          ref="hoverFloatingRef"
          class="transit-node-hover-tooltip"
          :style="hoverFloatingStyle"
          @mouseenter="clearHideTimer"
          @mouseleave="handleTooltipMouseLeave"
        >
          <!-- Title -->
          <div class="tooltip-title">
            {{ hoveredActivity.title || 'Остановка маршрута' }}
          </div>

          <!-- Description rendered via Milkdown Markdown with scroll -->
          <div v-if="hoveredDescriptionModel" class="tooltip-desc-box">
            <KitInlineMdEditorWrapper
              :key="hoveredActivity.id"
              v-model="hoveredDescriptionModel"
              :readonly="true"
              :features="{ 'block-edit': false }"
              class="tooltip-md-viewer"
            />
          </div>

          <!-- Metro Rides Preview if present -->
          <div v-if="getActivityMetroRides(hoveredActivity).length > 0" class="tooltip-metro-list">
            <div
              v-for="ride in getActivityMetroRides(hoveredActivity)"
              :key="ride.id"
              class="tooltip-metro-item"
              :style="{ borderLeftColor: ride.lineColor }"
            >
              <span class="metro-badge" :style="{ backgroundColor: ride.lineColor }">
                <Icon icon="mdi:subway-variant" />
                {{ ride.lineNumber || 'M' }} {{ ride.lineName }}
              </span>
              <span class="metro-stations">
                {{ ride.startStation || 'Отправление' }} → {{ ride.endStation || 'Назначение' }}
              </span>
            </div>
          </div>

          <!-- Subtle bottom hint -->
          <div class="tooltip-footer">
            <Icon icon="mdi:cursor-default-click-outline" />
            <span>Кликните карточку для деталей</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.transit-canvas-viewport {
  position: relative;
  width: 100%;
  height: 400px;
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
    height: 340px;
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

/* Floating Layout Tabs */
.canvas-floating-tabs {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 3px;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 3px;
  box-shadow: var(--s-m);
  backdrop-filter: blur(10px);
  max-width: calc(100% - 24px);
  overflow-x: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.layout-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: var(--r-xs);
  background: transparent;
  border: none;
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);

  .tab-icon {
    font-size: 0.88rem;
    flex-shrink: 0;
  }

  &:hover {
    color: var(--fg-primary-color);
    background: var(--bg-hover-color);
  }

  &.active {
    background: var(--fg-accent-color);
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(var(--fg-accent-color-rgb), 0.35);

    .tab-icon {
      color: #ffffff;
    }
  }

  @include media-down(md) {
    padding: 4px 6px;
    .tab-label {
      display: none;
    }
  }
}

/* SVG Tracks Layer */
.transit-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  animation: transitTracksFadeIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes transitTracksFadeIn {
  0% {
    opacity: 0;
  }
  40% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
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

.edge-badge-group {
  cursor: pointer;
  pointer-events: auto;

  &:hover {
    .edge-badge-bg {
      fill: var(--bg-hover-color);
      stroke-width: 2.2px;
      filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.4));
    }

    .edge-badge-text {
      fill: var(--fg-accent-color);
      font-weight: 800;
    }
  }
}

.edge-badge-bg {
  fill: var(--bg-tertiary-color);
  stroke-width: 1.5px;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25));
  transition:
    fill 0.15s ease,
    stroke-width 0.15s ease,
    filter 0.15s ease;
}

.edge-badge-text {
  fill: var(--fg-primary-color);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  user-select: none;
  pointer-events: none;
  transition: fill 0.15s ease;
}

/* Column Layout Styles */
.spine-track-line {
  fill: none;
  stroke: var(--border-primary-color);
  stroke-width: 5px;
  stroke-linecap: round;
}

.spine-hub-dot {
  stroke: var(--bg-secondary-color);
  stroke-width: 2.5px;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.3));
}

/* Radial Layout Styles */
.radial-orbit-ring {
  fill: none;
  stroke: var(--border-secondary-color);
  stroke-width: 2px;
  stroke-dasharray: 6 6;
  opacity: 0.75;
}

.radial-center-hub {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
  animation: transitTracksFadeIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;

  .radial-hub-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 130px;
    height: 130px;
    border-radius: 50%;
    background: var(--bg-tertiary-color);
    border: 2px solid var(--border-secondary-color);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    text-align: center;
    padding: 8px;
    box-sizing: border-box;

    .hub-icon {
      font-size: 1.4rem;
      color: var(--fg-accent-color);
      margin-bottom: 2px;
    }

    .hub-progress {
      display: inline-flex;
      align-items: baseline;
      gap: 2px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;

      .hub-done-num {
        font-size: 1.15rem;
        color: #10b981;
      }

      .hub-slash {
        font-size: 0.85rem;
        color: var(--fg-tertiary-color);
      }

      .hub-total-num {
        font-size: 0.95rem;
        color: var(--fg-primary-color);
      }
    }

    .hub-subtitle {
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--fg-tertiary-color);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .hub-timespan {
      margin-top: 4px;
      font-size: 0.62rem;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;
      background: var(--bg-secondary-color);
      padding: 1px 6px;
      border-radius: 999px;
      border: 1px solid var(--border-secondary-color);
    }
  }
}

/* Day Phases Layout Styles */
.phases-background-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
  animation: transitTracksFadeIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.phase-container-card {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--r-m);
  background: color-mix(in srgb, var(--bg-tertiary-color) 65%, transparent);
  border: 1px dashed var(--border-secondary-color);
  padding: 10px 12px;
  box-sizing: border-box;
  backdrop-filter: blur(4px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &.phase--morning {
    border-color: rgba(245, 158, 11, 0.35);
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%);
  }

  &.phase--afternoon {
    border-color: rgba(59, 130, 246, 0.35);
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
  }

  &.phase--evening {
    border-color: rgba(139, 92, 246, 0.35);
    background: linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%);
  }

  .phase-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .phase-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: var(--r-xs);
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-accent-color);
      font-size: 0.95rem;
    }

    .phase-info {
      display: flex;
      flex-direction: column;
      flex: 1;

      .phase-title {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--fg-primary-color);
      }

      .phase-timespan {
        font-size: 0.64rem;
        color: var(--fg-tertiary-color);
        font-variant-numeric: tabular-nums;
      }
    }

    .phase-count-badge {
      font-size: 0.65rem;
      font-weight: 800;
      color: var(--fg-secondary-color);
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      padding: 1px 6px;
      border-radius: 999px;
    }
  }
}

/* Station Node Positioner */
.transit-node-positioner {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Floating Zoom & Fit Controls */
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

/* Desktop Hover Detail Tooltip */
.transit-node-hover-tooltip {
  z-index: var(--z-tooltip, 1400);
  background: color-mix(in srgb, var(--bg-tertiary-color) 96%, var(--bg-secondary-color));
  color: var(--fg-primary-color);
  padding: 12px 14px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(14px);
  width: 380px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
}

.tooltip-title {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  line-height: 1.35;
  word-break: break-word;
}

.tooltip-desc-box {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px 10px;
  max-height: 220px;
  overflow-y: auto;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: 4px;
  }
}

.tooltip-md-viewer {
  :deep(.milkdown) {
    > div {
      padding: 0;
      min-height: auto;
      background: transparent;
    }

    .ProseMirror {
      p {
        font-size: 0.82rem;
        line-height: 1.55;
        color: var(--fg-primary-color);
        margin: 0 0 6px 0;

        &:last-child {
          margin-bottom: 0;
        }
      }

      ul,
      ol {
        padding-left: 16px;
        margin: 4px 0;
        font-size: 0.82rem;
        color: var(--fg-primary-color);
      }

      li {
        margin-bottom: 2px;
      }

      blockquote {
        border-left: 3px solid var(--fg-accent-color);
        padding-left: 8px;
        margin: 6px 0;
        color: var(--fg-secondary-color);
        font-style: italic;
      }

      code {
        background: var(--bg-tertiary-color);
        padding: 2px 4px;
        border-radius: var(--r-2xs);
        font-size: 0.76rem;
      }
    }
  }
}

.tooltip-metro-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-metro-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 3px solid;
  border-radius: var(--r-2xs);
  padding: 3px 6px;

  .metro-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #ffffff;
    font-size: 0.62rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .metro-stations {
    font-size: 0.72rem;
    color: var(--fg-primary-color);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.tooltip-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.66rem;
  color: var(--fg-tertiary-color);
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-secondary-color);
}

.transit-tooltip-fade-enter-active,
.transit-tooltip-fade-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.transit-tooltip-fade-enter-from,
.transit-tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}
</style>
