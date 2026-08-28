<script setup lang="ts">
import type { IActivity } from '~/components/05.modules/trip-info/models/types'
import type { ActivitySectionMetro, MetroRide } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { timeToMinutes } from '~/shared/lib/date-time'
import { EActivitySectionType, EActivityTag } from '~/shared/types/models/activity'

interface Props {
  fromActivity: IActivity
  toActivity: IActivity
  orientation?: 'horizontal' | 'vertical'
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
  isEditMode: false,
})

const gapMinutes = computed(() => {
  const fromEnd = timeToMinutes(props.fromActivity.endTime)
  const toStart = timeToMinutes(props.toActivity.startTime)
  return toStart - fromEnd
})

const metroRide = computed((): MetroRide | null => {
  const metroSection = props.fromActivity.sections?.find(
    s => s.type === EActivitySectionType.METRO,
  ) as ActivitySectionMetro | undefined

  if (metroSection?.rides && metroSection.rides.length > 0) {
    return metroSection.rides[0]
  }

  const nextMetroSection = props.toActivity.sections?.find(
    s => s.type === EActivitySectionType.METRO,
  ) as ActivitySectionMetro | undefined

  if (nextMetroSection?.rides && nextMetroSection.rides.length > 0) {
    return nextMetroSection.rides[0]
  }

  return null
})

const isWalk = computed(() => {
  return props.fromActivity.tag === EActivityTag.WALK || props.toActivity.tag === EActivityTag.WALK
})

const isTransport = computed(() => {
  return !!metroRide.value
    || props.fromActivity.tag === EActivityTag.TRANSPORT
    || props.toActivity.tag === EActivityTag.TRANSPORT
})

const edgeLineColor = computed(() => {
  if (metroRide.value?.lineColor) {
    return metroRide.value.lineColor
  }
  if (isWalk.value) {
    return 'var(--border-secondary-color)'
  }
  if (isTransport.value) {
    return 'var(--fg-accent-color)'
  }
  return 'var(--border-secondary-color)'
})

const formattedDuration = computed(() => {
  const gap = gapMinutes.value
  if (gap === 0)
    return null
  if (gap < 0)
    return 'Пересечение'
  if (gap < 60)
    return `${gap} мин`
  const hours = Math.floor(gap / 60)
  const mins = gap % 60
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
})
</script>

<template>
  <div
    class="transit-edge"
    :class="[
      `transit-edge--${orientation}`,
      {
        'is-metro': !!metroRide,
        'is-walk': isWalk,
        'is-transport': isTransport,
        'is-overlap': gapMinutes < 0,
      },
    ]"
    :style="{ '--edge-color': edgeLineColor }"
  >
    <!-- Connecting Line -->
    <div class="edge-track">
      <div class="edge-line" />
      <div v-if="!isEditMode && (isTransport || metroRide)" class="edge-pulse-dot" />
    </div>

    <!-- Edge Info Badge -->
    <div class="edge-info">
      <!-- Metro badge -->
      <div v-if="metroRide" class="edge-metro-pill" :style="{ backgroundColor: metroRide.lineColor }">
        <Icon icon="mdi:subway-variant" class="metro-icon" />
        <span v-if="metroRide.lineNumber" class="line-num">{{ metroRide.lineNumber }}</span>
        <span class="line-name">{{ metroRide.lineName || 'Метро' }}</span>
        <span v-if="metroRide.stops" class="stops-count">• {{ metroRide.stops }} ост.</span>
      </div>

      <!-- Gap / Transit duration badge -->
      <div
        v-else-if="formattedDuration"
        class="edge-time-pill"
        :class="{ 'is-negative': gapMinutes < 0 }"
      >
        <Icon
          :icon="gapMinutes < 0 ? 'mdi:alert-circle-outline' : (isWalk ? 'mdi:walk' : 'mdi:clock-outline')"
          class="pill-icon"
        />
        <span>{{ formattedDuration }}</span>
      </div>

      <!-- Default subtle arrow -->
      <div v-else class="edge-arrow">
        <Icon :icon="orientation === 'horizontal' ? 'mdi:arrow-right' : 'mdi:arrow-down'" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.transit-edge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;

  &--horizontal {
    flex-direction: column;
    min-width: 64px;
    height: 72px;
    padding: 0 4px;

    .edge-track {
      position: absolute;
      top: 36px;
      left: 0;
      right: 0;
      height: 3px;
      transform: translateY(-50%);
    }

    .edge-line {
      width: 100%;
      height: 3px;
      background-color: var(--edge-color, var(--border-secondary-color));
      border-radius: 2px;
    }

    .edge-pulse-dot {
      position: absolute;
      top: 50%;
      left: 0;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--edge-color, var(--fg-accent-color));
      transform: translateY(-50%);
      animation: transit-flow-h 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      box-shadow: 0 0 6px var(--edge-color, var(--fg-accent-color));
    }
  }

  &--vertical {
    flex-direction: row;
    width: 100%;
    min-height: 48px;
    padding: 4px 0;

    .edge-track {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 28px;
      width: 3px;
      transform: translateX(-50%);
    }

    .edge-line {
      width: 3px;
      height: 100%;
      background-color: var(--edge-color, var(--border-secondary-color));
      border-radius: 2px;
    }

    .edge-pulse-dot {
      position: absolute;
      top: 0;
      left: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--edge-color, var(--fg-accent-color));
      transform: translateX(-50%);
      animation: transit-flow-v 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      box-shadow: 0 0 6px var(--edge-color, var(--fg-accent-color));
    }

    .edge-info {
      margin-left: 48px;
    }
  }

  &.is-walk .edge-line {
    border-top: 2px dashed var(--border-secondary-color);
    background-color: transparent !important;
    height: 0 !important;
  }

  &.is-overlap .edge-line {
    background-color: var(--fg-error-color) !important;
  }
}

.edge-info {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edge-metro-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  letter-spacing: 0.02em;

  .metro-icon {
    font-size: 0.85rem;
  }

  .line-num {
    background: rgba(0, 0, 0, 0.3);
    padding: 0 4px;
    border-radius: 4px;
    font-weight: 700;
  }

  .stops-count {
    opacity: 0.85;
    font-size: 0.68rem;
  }
}

.edge-time-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 999px;
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: var(--s-xs);

  .pill-icon {
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
  }

  &.is-negative {
    background: rgba(var(--fg-error-color-rgb), 0.1);
    border-color: var(--fg-error-color);
    color: var(--fg-error-color);

    .pill-icon {
      color: var(--fg-error-color);
    }
  }
}

.edge-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-tertiary-color);
  font-size: 0.75rem;
}

@keyframes transit-flow-h {
  0% {
    left: 0%;
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}

@keyframes transit-flow-v {
  0% {
    top: 0%;
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}
</style>
