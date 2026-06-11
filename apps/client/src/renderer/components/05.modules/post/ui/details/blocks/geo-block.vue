<script setup lang="ts">
import type { MapPoint, MapRoute } from '~/components/03.domain/trip-info/geolocation-section'
import type { LocationBlock, RouteBlock } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import GeolocationMap from '~/components/03.domain/trip-info/geolocation-section/ui/geolocation-map.vue'
import { vRipple } from '~/shared/directives/ripple'

const props = withDefaults(defineProps<{
  block: LocationBlock | RouteBlock
  color?: string
  isActive?: boolean
}>(), {
  color: '#FF9F43',
  isActive: false,
})

const emit = defineEmits<{ (e: 'click'): void }>()

const isInlineMapOpen = ref(false)

const title = computed(() => {
  if (props.block.type === 'location')
    return props.block.name || 'Локация'
  return `${props.block.from || 'Начало'} ➝ ${props.block.to || 'Конец'}`
})

const subtitle = computed(() => {
  if (props.block.type === 'location')
    return props.block.address
  return `${props.block.distance || ''} ${props.block.duration ? `• ${props.block.duration}` : ''} ${props.block.transport ? `(${props.block.transport})` : ''}`.trim()
})

const icon = computed(() => {
  if (props.block.type === 'location')
    return 'mdi:map-marker'
  return props.block.transport === 'walk' ? 'mdi:walk' : props.block.transport === 'car' ? 'mdi:car' : 'mdi:bus'
})

const mapPoints = computed<MapPoint[]>(() => {
  if (props.block.type === 'location' && props.block.coords) {
    return [{
      id: props.block.id,
      type: 'poi',
      coordinates: [props.block.coords.lng, props.block.coords.lat],
      address: props.block.address,
      comment: props.block.name,
      style: { color: props.color },
    } as any]
  }
  return []
})

const mapRoutes = computed<MapRoute[]>(() => {
  if (props.block.type === 'route' && (props.block as any).geometry && (props.block as any).geometry.length > 0) {
    const pts = ((props.block as any).points || []).map((p: any, idx: number, arr: any[]) => ({
      id: `${props.block.id}-pt-${idx}`,
      coordinates: [p.lng, p.lat],
      type: idx === 0 ? 'start' : idx === arr.length - 1 ? 'end' : 'via',
      address: p.label,
      comment: p.label,
      style: { color: props.color },
    }))
    return [{
      id: props.block.id,
      title: title.value,
      points: pts,
      geometry: (props.block as any).geometry,
      color: props.color,
      isVisible: true,
      isDirect: false,
    } as any]
  }
  return []
})

const mapCenter = computed<[number, number]>(() => {
  if (props.block.type === 'location' && props.block.coords) {
    return [props.block.coords.lng, props.block.coords.lat]
  }
  if (props.block.type === 'route' && (props.block as any).geometry && (props.block as any).geometry.length > 0) {
    return (props.block as any).geometry[0]
  }
  return [37.6176, 55.7558]
})
</script>

<template>
  <div class="geo-block-wrapper">
    <button v-ripple class="geo-block" :class="{ 'is-active': isActive }" @click="emit('click')">
      <div class="icon-box" :style="{ color: props.color }">
        <Icon :icon="icon" />
      </div>
      <div class="info">
        <span class="geo-title">{{ title }}</span>
        <span v-if="subtitle" class="geo-subtitle">{{ subtitle }}</span>
      </div>

      <div class="actions" @click.stop>
        <button class="inline-map-btn" :title="isInlineMapOpen ? 'Скрыть карту' : 'Показать карту здесь'" @click.stop="isInlineMapOpen = !isInlineMapOpen">
          <Icon :icon="isInlineMapOpen ? 'mdi:map-minus' : 'mdi:map-plus'" />
        </button>
      </div>
      <Icon icon="mdi:chevron-right" class="arrow" />
    </button>

    <div v-if="isInlineMapOpen" class="inline-map-container">
      <GeolocationMap
        :points="mapPoints"
        :routes="mapRoutes"
        :drawn-routes="[]"
        mode="pan"
        :center="mapCenter"
        height="300px"
        :is-loading="false"
        :readonly="true"
        :is-fullscreen="false"
        :with-panel="false"
        :interactive-on-click="false"
        :disable-context-menu="true"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.geo-block-wrapper {
  margin: 8px 0;
  width: 100%;
}

.geo-block {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }

  &.is-active {
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }
}

.icon-box {
  width: 36px;
  height: 36px;
  background: var(--bg-secondary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.geo-title {
  font-weight: 600;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.geo-subtitle {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  align-items: center;
}

.inline-map-btn {
  background: transparent;
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.inline-map-container {
  margin-top: 8px;
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-s);
}

.arrow {
  color: var(--fg-tertiary-color);
  font-size: 1.2rem;
  margin-left: 4px;
}
</style>
