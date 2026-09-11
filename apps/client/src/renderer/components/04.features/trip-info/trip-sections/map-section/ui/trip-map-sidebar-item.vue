<script setup lang="ts">
import type { MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section'
import { Icon } from '@iconify/vue'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'

interface Props {
  item: (MapPoint | MapRoute) & { dayId?: string }
  type: 'point' | 'route'
  active?: boolean
}
const props = defineProps<Props>()

const itemIcon = computed(() => {
  if (props.type === 'point') {
    const point = props.item as MapPoint
    switch (point.type) {
      case 'start':
        return 'mdi:flag-variant-outline'
      case 'end':
        return 'mdi:flag-checkered'
      case 'via':
        return 'mdi:map-marker-path'
      default:
        return 'mdi:map-marker'
    }
  }

  if ('isDirect' in props.item && props.item.isDirect)
    return 'mdi:vector-line'

  return 'mdi:directions'
})

const itemText = computed(() => {
  if (props.type === 'point') {
    const point = props.item as MapPoint
    return point.comment || point.address || 'Точка на карте'
  }
  return (props.item as MapRoute).title || 'Маршрут'
})

const itemSubtitle = computed(() => {
  if (props.type === 'point') {
    const point = props.item as MapPoint
    if (point.comment)
      return point.address

    return null
  }
  if ('points' in props.item && props.item.points)
    return `${props.item.points.length} тчк.`

  return 'Маршрут'
})

const itemColor = computed(() => {
  if (props.type === 'point') {
    const point = props.item as MapPoint

    if (point.style?.color)
      return point.style.color

    switch (point.type) {
      case 'start':
        return 'var(--fg-success-color)'
      case 'end':
        return 'var(--fg-error-color)'
      case 'connect':
        return 'var(--fg-tertiary-color)'
      case 'via':
      case 'poi':
      default:
        return 'var(--fg-accent-color)'
    }
  }

  return (props.item as MapRoute).color || 'var(--fg-accent-color)'
})
</script>

<template>
  <div class="sidebar-item" :class="{ 'is-active': active }">
    <div class="item-icon-wrapper" :style="{ color: itemColor }">
      <Icon v-if="itemIcon" :icon="itemIcon" class="item-icon" />
    </div>
    <div class="item-info">
      <KitTooltip :text="itemText">
        <span class="item-text">{{ itemText }}</span>
      </KitTooltip>
      <span v-if="itemSubtitle" class="item-subtitle">{{ itemSubtitle }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: rgba(var(--bg-tertiary-color-rgb), 0.5);

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &.is-active {
    background-color: color-mix(in srgb, var(--fg-accent-color) 14%, var(--bg-tertiary-color));
    box-shadow: inset 3px 0 0 var(--fg-accent-color);
  }
}

.item-icon-wrapper {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-s);
  border: 1px solid currentColor;
  background-color: color-mix(in srgb, currentColor 12%, transparent);
  transition: all 0.2s ease;

  .sidebar-item:hover & {
    background-color: color-mix(in srgb, currentColor 20%, transparent) !important;
  }
}

.item-icon {
  font-size: 1.1rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;

  :deep(.kit-tooltip-wrapper),
  :deep(.kit-tooltip-trigger) {
    display: block;
    min-width: 0;
    max-width: 100%;
  }
}

.item-text {
  display: block;
  max-width: 100%;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.item-subtitle {
  display: block;
  max-width: 100%;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
</style>
