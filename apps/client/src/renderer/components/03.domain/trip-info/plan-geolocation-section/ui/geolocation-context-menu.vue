<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface MenuItem {
  id: string
  label: string
  icon: string
}

defineProps<{
  visible: boolean
  top: number
  left: number
}>()

const emit = defineEmits<{
  (e: 'action', value: string): void
}>()

const menuItems: MenuItem[] = [
  { id: 'route-from', label: 'Маршрут отсюда', icon: 'mdi:directions-fork' },
  { id: 'draw-new-route', label: 'Рисовать новый маршрут', icon: 'mdi:draw-pen' },
  { id: 'show-address', label: 'Показать адрес', icon: 'mdi:map-marker-question-outline' },
  { id: 'show-current-location', label: 'Мое местоположение', icon: 'mdi:crosshairs-gps' },
  { id: 'center-map', label: 'Центрировать карту', icon: 'mdi:crosshairs' },
]

function handleAction(actionId: string) {
  emit('action', actionId)
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ top: `${top}px`, left: `${left}px` }"
    >
      <ul>
        <li
          v-for="item in menuItems"
          :key="item.id"
          class="menu-item"
          @click="handleAction(item.id)"
        >
          <Icon :icon="item.icon" class="item-icon" />
          <span>{{ item.label }}</span>
        </li>
      </ul>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.context-menu {
  position: absolute;
  z-index: 1001;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  box-shadow: var(--s-l);
  min-width: 220px;
  padding: 6px;
  user-select: none;

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r-xs);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  .item-icon {
    font-size: 1.1rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
