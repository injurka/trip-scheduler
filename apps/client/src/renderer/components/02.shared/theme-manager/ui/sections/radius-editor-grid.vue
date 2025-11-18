<script setup lang="ts">
import type { RadiusPalette } from '~/shared/store/theme.store'
import { variableNameToHumanReadable } from '../../lib/theme'

const radiusPalette = defineModel<RadiusPalette>({ required: true })
</script>

<template>
  <div class="radius-editor-grid">
    <div v-for="(_, key) in radiusPalette" :key="key" class="radius-editor-item">
      <label
        :for="key.toString()"
        class="radius-editor-label"
      >
        {{ variableNameToHumanReadable(key.toString()) }}
      </label>
      <div class="radius-editor-input-group">
        <input
          v-model="radiusPalette[key]"
          type="text"
          class="radius-editor-input"
          placeholder="e.g. 8px"
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.radius-editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.radius-editor-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-focus-color);
    background: var(--bg-primary-color);
  }
}

.radius-editor-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.radius-editor-input-group {
  display: flex;
}

.radius-editor-input {
  flex: 1;
  padding: 8px 0px;
  padding-left: 8px;
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-xs);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  width: 100%;

  &:focus {
    outline: none;
    border-color: var(--border-accent-color);
    box-shadow: 0 0 0 3px var(--bg-accent-color);
  }

  &::placeholder {
    color: var(--fg-tertiary-color);
  }
}
</style>
