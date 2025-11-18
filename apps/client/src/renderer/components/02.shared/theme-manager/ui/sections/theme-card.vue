<script setup lang="ts">
import type { ThemeType } from '~/shared/types/models/theme'
import { Icon } from '@iconify/vue'

defineProps<{
  type: ThemeType
  title: string
  description: string
  icon: string
  isActive: boolean
}>()

const emit = defineEmits<{
  (e: 'select', type: ThemeType): void
  (e: 'openSettings'): void
}>()
</script>

<template>
  <div class="theme-card" :class="{ 'active': isActive, 'theme-card--custom': type === 'custom' }">
    <div
      class="theme-card-preview"
      :class="`theme-card-preview--${type}`"
      @click="emit('select', type)"
    >
      <div class="preview-header" />
      <div class="preview-content">
        <div class="preview-element" />
        <div class="preview-element preview-element--small" />
      </div>
      <div v-if="type === 'custom'" class="custom-gradient" />
    </div>

    <div class="theme-card-info">
      <div class="theme-card-main" @click="emit('select', type)">
        <div class="theme-card-icon">
          <Icon :icon="icon" />
        </div>
        <div class="theme-card-content">
          <h3 class="theme-card-title">
            {{ title }}
          </h3>
          <p class="theme-card-description">
            {{ description }}
          </p>
        </div>
        <div v-if="isActive" class="theme-card-check">
          <Icon icon="mdi:check-circle" />
        </div>
      </div>
      <div v-if="type === 'custom'" class="theme-card-settings" @click="emit('openSettings')">
        <Icon icon="mdi:cog" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '~/assets/scss/themes/light/_variables.scss' as light-theme;
@use '~/assets/scss/themes/dark/_variables.scss' as dark-theme;

.theme-card {
  border: 2px solid var(--border-primary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-secondary-color);

  &:hover {
    border-color: var(--border-focus-color);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--border-pressed-color);
    box-shadow:
      0 0 0 1px var(--border-pressed-color),
      0 4px 20px var(--bg-overlay-primary-color);
  }

  .theme-card-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &--custom {
    .theme-card-info {
      display: flex;
      align-items: stretch;
      padding: 0;
    }

    .theme-card-main {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 16px;
      gap: 16px;
    }

    .theme-card-settings {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 60px;
      background: var(--bg-primary-color);
      border-left: 1px solid var(--border-primary-color);
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--fg-secondary-color);

      &:hover {
        background: var(--fg-accent-color);
        color: var(--fg-inverted-color);
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }
  }

  &-preview {
    height: 60px;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 8px;

    .preview-header {
      height: 16px;
      border-radius: var(--r-2xs);
      margin-bottom: 8px;
    }

    .preview-content {
      flex: 1;
      display: flex;
      gap: 6px;
    }

    .preview-element {
      height: 24px;
      border-radius: var(--r-2xs);
      flex: 1;

      &--small {
        flex: 0.3;
      }
    }

    &--light {
      background: linear-gradient(135deg, light-theme.$bg-primary-color 0%, light-theme.$bg-tertiary-color 100%);

      .preview-header {
        background: light-theme.$fg-primary-color;
      }

      .preview-element {
        background: light-theme.$fg-secondary-color;

        &--small {
          background: light-theme.$fg-tertiary-color;
        }
      }
    }

    &--dark {
      background: linear-gradient(135deg, dark-theme.$bg-primary-color 0%, dark-theme.$bg-secondary-color 100%);

      .preview-header {
        background: dark-theme.$fg-primary-color;
      }

      .preview-element {
        background: dark-theme.$fg-secondary-color;

        &--small {
          background: dark-theme.$fg-tertiary-color;
        }
      }
    }

    &--custom {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      position: relative;

      .custom-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          45deg,
          rgba(255, 255, 255, 0.1) 0%,
          rgba(255, 255, 255, 0) 50%,
          rgba(255, 255, 255, 0.1) 100%
        );
      }

      .preview-header,
      .preview-element {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(4px);
      }

      .preview-element--small {
        background: rgba(255, 255, 255, 0.6);
      }
    }
  }

  &-info {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary-color);
    flex-shrink: 0;

    svg {
      width: 24px;
      height: 24px;
    }
  }

  &-content {
    flex: 1;
  }

  &-title {
    margin: 0 0 4px 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  &-description {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    line-height: 1.3;
  }

  &-check {
    width: 24px;
    height: 24px;
    color: var(--border-accent-color);
    flex-shrink: 0;

    svg {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
