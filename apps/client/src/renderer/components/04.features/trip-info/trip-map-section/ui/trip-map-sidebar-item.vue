<script setup lang="ts">
import type { DrawnRoute, MapPoint, MapRoute } from '~/components/03.domain/trip-info/plan-geolocation-section'
import { Icon } from '@iconify/vue'

interface Props {
  item: (MapPoint | MapRoute | DrawnRoute) & { dayId?: string }
  type: 'point' | 'route'
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

  if ('segments' in props.item)
    return 'mdi:draw'

  return 'mdi:directions'
})

const itemText = computed(() => {
  if (props.type === 'point') {
    const point = props.item as MapPoint
    return point.comment || point.address || 'Точка на карте'
  }
  return (props.item as MapRoute | DrawnRoute).title || 'Маршрут'
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

  if ('segments' in props.item && props.item.segments)
    return `${props.item.segments.length} сег.`

  return 'Маршрут'
})

const itemColor = computed(() => {
  if (props.type === 'point')
    return (props.item as MapPoint).style?.color

  return (props.item as MapRoute | DrawnRoute).color
})
</script>

<template>
  <div class="sidebar-item">
    <div class="item-icon-wrapper" :style="{ borderColor: itemColor, backgroundColor: `${itemColor}20` }">
      <Icon v-if="itemIcon" :icon="itemIcon" class="item-icon" :style="{ color: itemColor }" />
    </div>
    <div class="item-info">
      <span class="item-text" :title="itemText">{{ itemText }}</span>
      <span v-if="itemSubtitle" class="item-subtitle">{{ itemSubtitle }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: rgba(var(--bg-tertiary-color-rgb), 0.5);

  &:hover {
    background-color: var(--bg-hover-color);
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
  border: 1px solid;
  transition: all 0.2s ease;

  .sidebar-item:hover & {
    background-color: var(--bg-primary-color) !important;
  }
}

.item-icon {
  font-size: 1.1rem;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex-grow: 1;
}

.item-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.item-subtitle {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
</style>
