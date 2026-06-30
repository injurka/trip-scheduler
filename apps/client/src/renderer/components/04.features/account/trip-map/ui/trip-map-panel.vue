<script setup lang="ts">
import type { MapCity } from '../composables/use-trip-map'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

defineProps<{
  open: boolean
  cities: MapCity[]
  grouped: [string, MapCity[]][]
}>()

defineEmits<{
  'update:open': [boolean]
  'cityClick': [MapCity]
}>()

const rootRef = ref<HTMLDivElement | null>(null)
defineExpose({ rootRef })
</script>

<template>
  <Transition name="city-panel">
    <div
      v-if="open && cities.length > 0"
      ref="rootRef"
      class="trip-map-panel"
      @click.stop
      @mousedown.stop
    >
      <div class="panel-head">
        <span class="panel-title">Посещённые места</span>
        <button
          class="panel-close"
          aria-label="Закрыть"
          @click="$emit('update:open', false)"
        >
          <Icon icon="mdi:close" width="15" height="15" />
        </button>
      </div>
      <div class="panel-body">
        <template v-for="[country, list] in grouped" :key="country">
          <div class="panel-country">
            {{ country }}
          </div>
          <div
            v-for="c in list"
            :key="c.id"
            class="panel-city"
            @click="$emit('cityClick', c)"
          >
            {{ c.name }}
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.trip-map-panel {
  position: absolute;
  top: 52px;
  left: 10px;
  width: 220px;
  max-height: calc(100% - 62px);
  display: flex;
  flex-direction: column;
  background: rgba(var(--bg-secondary-color-rgb), 0.94);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  z-index: 20;
  box-shadow: var(--s-m);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--fg-primary-color);
  }
}

.panel-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
  padding: 6px 0;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 2px;
  }
}

.panel-country {
  padding: 8px 12px 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-accent-color);

  & ~ & {
    margin-top: 2px;
    border-top: 1px solid var(--border-secondary-color);
  }
}

.panel-city {
  padding: 5px 12px 5px 22px;
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition:
    color 0.13s,
    background 0.13s;

  &:hover {
    color: var(--fg-primary-color);
    background: var(--bg-tertiary-color);
  }
}

.city-panel-enter-active,
.city-panel-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.city-panel-enter-from,
.city-panel-leave-to {
  opacity: 0;
  transform: translateX(-8px) scale(0.97);
}
</style>
