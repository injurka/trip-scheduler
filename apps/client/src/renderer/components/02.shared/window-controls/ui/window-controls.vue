<script setup lang="ts">
import { Icon } from '@iconify/vue'

const isElectron = computed(() => !!window.electronAPI?.window)

function handleMinimize() {
  window.electronAPI?.window.minimize()
}

function handleMaximize() {
  window.electronAPI?.window.toggleMaximize()
}

function handleClose() {
  window.electronAPI?.window.close()
}
</script>

<template>
  <div v-if="isElectron" class="window-controls-container">
    <div class="controls-panel">
      <button class="control-btn minimize" title="Свернуть" @click="handleMinimize">
        <Icon icon="mdi:minus" />
      </button>
      <button class="control-btn maximize" title="Развернуть" @click="handleMaximize">
        <Icon icon="mdi:window-maximize" />
      </button>
      <button class="control-btn close" title="Закрыть" @click="handleClose">
        <Icon icon="mdi:window-close" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.window-controls-container {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 9999;

  width: 150px;
  height: 40px;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  opacity: 0;
  transition: opacity 0.2s ease-in-out;

  &:hover {
    opacity: 1;
  }
}

.controls-panel {
  display: flex;
  background-color: var(--bg-secondary-color);
  border-bottom-left-radius: var(--r-m);
  border-left: 1px solid var(--border-secondary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  overflow: hidden;
  box-shadow: var(--s-m);
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;
  -webkit-app-region: no-drag;

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
