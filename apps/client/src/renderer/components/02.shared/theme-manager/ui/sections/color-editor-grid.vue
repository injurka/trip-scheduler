<script setup lang="ts">
import type { ColorPalette } from '~/shared/store/theme.store'
import { variableNameToHumanReadable } from '../../lib/theme'

const palette = defineModel<ColorPalette>({ required: true })
</script>

<template>
  <div class="theme-editor-grid">
    <div v-for="(color, key) in palette" :key="key" class="theme-editor-item">
      <label
        :for="key.toString()"
        class="theme-editor-label"
        :style="{ '--label-color-preview': color }"
      >
        {{ variableNameToHumanReadable(key.toString()) }}
      </label>
      <div class="theme-editor-input-group">
        <div class="color-picker-wrapper">
          <input
            :id="key.toString()"
            v-model="palette[key]"
            type="color"
            class="theme-editor-color-swatch"
          >
        </div>
        <input
          v-model="palette[key]"
          type="text"
          class="theme-editor-hex-input"
          placeholder="#RRGGBB"
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.theme-editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  padding: 6px;
}

.theme-editor-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-focus-color);
    background: var(--bg-primary-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--bg-overlay-primary-color);
  }
}

.theme-editor-label {
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: var(--r-full);
    background-color: var(--label-color-preview);
    border: 1px solid var(--border-secondary-color);
    flex-shrink: 0;
  }
}

.theme-editor-input-group {
  display: flex;
  align-items: center;
  gap: 12px;

  .color-picker-wrapper {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: var(--r-xs);
      background: linear-gradient(45deg, transparent, var(--border-accent-color), transparent);
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: -1;
    }

    &:hover::after {
      opacity: 0.3;
    }
  }
}

.theme-editor-color-swatch {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border-primary-color);
  border-radius: var(--r-xs);
  cursor: pointer;
  background-color: transparent;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: var(--border-accent-color);
    transform: scale(1.05);
  }

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: var(--r-2xs);
  }

  &::-moz-color-swatch {
    border: none;
    border-radius: var(--r-2xs);
  }
}

.theme-editor-hex-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-xs);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--border-accent-color);
    box-shadow: 0 0 0 3px var(--bg-accent-color);
    background-color: var(--bg-secondary-color);
  }

  &::placeholder {
    color: var(--fg-tertiary-color);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.theme-editor-item {
  animation: slideIn 0.4s ease forwards;
  opacity: 0;

  @for $i from 1 through 50 {
    &:nth-child(#{$i}) {
      animation-delay: #{$i * 0.02}s;
    }
  }
}

@include media-down(sm) {
  .theme-editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
