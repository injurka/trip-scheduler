<script setup lang="ts">
import type { RouteBlock } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { KitInput } from '~/components/01.kit/kit-input'

const props = defineProps<{
  block: RouteBlock
}>()

const emit = defineEmits<{
  (e: 'update', payload: Partial<RouteBlock>): void
}>()

function toggleTransport() {
  const modes: RouteBlock['transport'][] = ['walk', 'transit', 'car']
  const currentIdx = modes.indexOf(props.block.transport)
  const nextMode = modes[(currentIdx + 1) % modes.length]
  emit('update', { transport: nextMode })
}

const transportIcons: Record<string, string> = {
  walk: 'mdi:walk',
  transit: 'mdi:bus',
  car: 'mdi:car',
}

function swapPoints() {
  emit('update', { from: props.block.to, to: props.block.from })
}
</script>

<template>
  <div class="route-editor">
    <div class="route-line">
      <button class="transport-btn" :title="block.transport" @click="toggleTransport">
        <Icon :icon="transportIcons[block.transport]" />
      </button>

      <div class="points-inputs">
        <div class="point-row">
          <div class="dot start" />
          <KitInput
            :model-value="block.from"
            placeholder="Откуда"
            size="sm"
            class="bare-input"
            @update:model-value="val => emit('update', { from: val as string })"
          />
        </div>
        <div class="connector" />
        <div class="point-row">
          <div class="dot end" />
          <KitInput
            :model-value="block.to"
            placeholder="Куда"
            size="sm"
            class="bare-input"
            @update:model-value="val => emit('update', { to: val as string })"
          />
        </div>
      </div>

      <button class="swap-btn" title="Поменять местами" @click="swapPoints">
        <Icon icon="mdi:swap-vertical" />
      </button>
    </div>

    <div class="meta-inputs">
      <div class="meta-field">
        <Icon icon="mdi:map-marker-distance" />
        <input
          :value="block.distance"
          placeholder="Расстояние (1.5 км)"
          @input="e => emit('update', { distance: (e.target as HTMLInputElement).value })"
        >
      </div>
      <div class="meta-field">
        <Icon icon="mdi:clock-outline" />
        <input
          :value="block.duration"
          placeholder="Время (20 мин)"
          @input="e => emit('update', { duration: (e.target as HTMLInputElement).value })"
        >
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.route-editor {
  background: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  padding: 8px;
  border: 1px solid var(--border-secondary-color);
}

.route-line {
  display: flex;
  gap: 12px;
  align-items: center;
}

.transport-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-accent-color);
  font-size: 1.1rem;
  flex-shrink: 0;

  &:hover {
    border-color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }
}

.points-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.point-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.start {
    background: var(--fg-success-color);
  }
  &.end {
    background: var(--fg-error-color);
  }
}

.connector {
  width: 2px;
  height: 12px;
  background: var(--border-secondary-color);
  margin-left: 3px; /* Center with 8px dot */
}

/* Скрываем рамки у инпутов для чистоты */
.bare-input :deep(input) {
  background: transparent;
  border-color: transparent;
  padding-left: 0;
  &:focus {
    border-color: var(--border-accent-color);
  }
}

.swap-btn {
  color: var(--fg-tertiary-color);
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px;
  &:hover {
    color: var(--fg-primary-color);
  }
}

.meta-inputs {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-secondary-color);
}

.meta-field {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  flex: 1;

  input {
    background: transparent;
    border: none;
    color: var(--fg-primary-color);
    width: 100%;
    font-size: 0.9rem;
    &:focus {
      outline: none;
      border-bottom: 1px solid var(--fg-accent-color);
    }
    &::placeholder {
      color: var(--fg-tertiary-color);
    }
  }
}
</style>
