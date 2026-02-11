<script setup lang="ts">
import { Icon } from '@iconify/vue'

// Проверяем, запущены ли мы в Electron
const isElectron = computed(() => !!window.electronAPI?.window)

// Проверяем платформу (опционально, чтобы скрыть кнопки на macOS, так как там есть свои "светофоры")
const isMac = navigator.platform.toUpperCase().includes('MAC')

const handleMinimize = () => window.electronAPI?.window.minimize()
const handleMaximize = () => window.electronAPI?.window.toggleMaximize()
const handleClose = () => window.electronAPI?.window.close()
</script>

<template>
  <div v-if="isElectron" class="app-title-bar">
    <!-- Иконка и название приложения (слева) -->
    <div class="app-info">
      <Icon icon="mdi:map-marker-path" class="app-icon" />
      <span class="app-title">Trip Scheduler</span>
    </div>

    <!-- Область перетаскивания (занимает все свободное место) -->
    <div class="drag-region" />

    <!-- Кнопки управления (только для Windows/Linux) -->
    <!-- На macOS используем v-if="!isMac", так как там системные кнопки слева -->
    <div v-if="!isMac" class="window-controls">
      <button class="control-btn minimize" tabindex="-1" @click="handleMinimize">
        <Icon icon="mdi:minus" />
      </button>
      <button class="control-btn maximize" tabindex="-1" @click="handleMaximize">
        <Icon icon="mdi:crop-square" />
      </button>
      <button class="control-btn close" tabindex="-1" @click="handleClose">
        <Icon icon="mdi:window-close" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-title-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 32px; /* Стандартная высота заголовка */
  background-color: var(--bg-secondary-color); /* Цвет фона шапки */
  border-bottom: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  z-index: 9999;
  user-select: none;
}

/* Самая важная часть: разрешает перетаскивание окна */
.app-title-bar {
  -webkit-app-region: drag;
}

/* Элементы внутри шапки, которые должны быть кликабельными,
   должны иметь no-drag, иначе клик не пройдет */
.window-controls button,
.app-info {
  -webkit-app-region: no-drag;
}

.app-info {
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-secondary-color);

  /* Если macOS, добавляем отступ слева, чтобы не наехать на светофор */
  /* padding-left: 80px; */
}

.drag-region {
  flex-grow: 1;
  /* Эта область прозрачна для кликов и служит только для drag */
}

.window-controls {
  display: flex;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 1rem;
  cursor: default; /* Нативная кнопка обычно имеет default курсор */
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.close:hover {
    background-color: #e81123;
    color: white;
  }
}
</style>
