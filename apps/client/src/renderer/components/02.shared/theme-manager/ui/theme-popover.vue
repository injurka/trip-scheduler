<script setup lang="ts">
import type { ThemeType } from '~/shared/types/models/theme'
import { Icon } from '@iconify/vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { useAppStore } from '~/shared/composables/use-store'

const store = useAppStore(['theme'])
const { activeThemeName } = storeToRefs(store.theme)

const isOpen = ref(false)

function selectTheme(themeName: ThemeType) {
  store.theme.setTheme(themeName)
  isOpen.value = false
}

function openCustomThemeModal() {
  store.theme.setTheme('custom')
  isOpen.value = false
  store.theme.openCreator()
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <KitTooltip text="Настроить тему">
      <PopoverTrigger as-child>
        <button
          class="util-btn"
          :class="{ 'is-active': isOpen }"
          aria-label="Настроить тему"
        >
          <Icon icon="mdi:palette-outline" />
        </button>
      </PopoverTrigger>
    </KitTooltip>

    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="8"
        :collision-padding="8"
        class="theme-popover-content"
        @close-auto-focus.prevent
      >
        <div class="theme-popover-header">
          <div class="header-title-group">
            <Icon icon="mdi:palette-swatch-outline" class="header-icon" />
            <span class="header-title">Тема оформления</span>
          </div>
        </div>

        <div class="theme-options">
          <!-- Светлая тема -->
          <button
            type="button"
            class="theme-option"
            :class="{ 'is-active': activeThemeName === 'light' }"
            @click="selectTheme('light')"
          >
            <div class="theme-preview theme-preview--light">
              <div class="preview-mini-header" />
              <div class="preview-mini-body">
                <div class="mini-bar" />
                <div class="mini-bar mini-bar--short" />
              </div>
            </div>

            <div class="theme-info">
              <span class="theme-name">Светлая</span>
            </div>

            <div class="theme-action">
              <Icon v-if="activeThemeName === 'light'" icon="mdi:check" class="check-icon" />
            </div>
          </button>

          <!-- Тёмная тема -->
          <button
            type="button"
            class="theme-option"
            :class="{ 'is-active': activeThemeName === 'dark' }"
            @click="selectTheme('dark')"
          >
            <div class="theme-preview theme-preview--dark">
              <div class="preview-mini-header" />
              <div class="preview-mini-body">
                <div class="mini-bar" />
                <div class="mini-bar mini-bar--short" />
              </div>
            </div>

            <div class="theme-info">
              <span class="theme-name">Тёмная</span>
            </div>

            <div class="theme-action">
              <Icon v-if="activeThemeName === 'dark'" icon="mdi:check" class="check-icon" />
            </div>
          </button>

          <!-- Своя тема (кастомная с шестеренкой) -->
          <div
            class="theme-option theme-option--custom"
            :class="{ 'is-active': activeThemeName === 'custom' }"
            @click="openCustomThemeModal"
          >
            <div class="theme-preview theme-preview--custom">
              <div class="preview-mini-header" />
              <div class="preview-mini-body">
                <div class="mini-bar" />
                <div class="mini-bar mini-bar--short" />
              </div>
            </div>

            <div class="theme-info">
              <span class="theme-name">Своя тема</span>
            </div>

            <div class="theme-actions">
              <Icon v-if="activeThemeName === 'custom'" icon="mdi:check" class="check-icon" />
              <KitTooltip text="Настроить" placement="top">
                <button
                  type="button"
                  class="settings-btn"
                  aria-label="Настроить свою тему"
                  @click.stop="openCustomThemeModal"
                >
                  <Icon icon="mdi:cog" class="gear-icon" />
                </button>
              </KitTooltip>
            </div>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
.util-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-xs);
  border: none;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition:
    all 0.2s ease,
    transform 0.1s ease;
  font-size: 1.2rem;
  overflow: hidden;
  position: relative;
  background: transparent;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background-color: var(--fg-accent-color);
    border-radius: 50%;
    transition: all 0.3s ease;
    transform: translate(-50%, -50%);
    opacity: 0.1;
    z-index: -1;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover,
    &.is-active {
      color: var(--fg-accent-color);
      transform: scale(1.1);

      &::before {
        width: 100%;
        height: 100%;
      }
    }
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>

<style lang="scss">
.theme-popover-content {
  min-width: 260px;
  padding: 8px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-xl);
  z-index: 2100;
  display: flex;
  flex-direction: column;
  gap: 6px;
  user-select: none;
  outline: none;
  animation: themePopoverFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &[data-side='top'] {
    animation-name: themePopoverSlideUp;
  }
  &[data-side='bottom'] {
    animation-name: themePopoverSlideDown;
  }
}

.theme-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 6px;
  border-bottom: 1px solid var(--border-secondary-color);

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
  }

  .header-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-tertiary-color);
  }
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--r-s);
  border: 1px solid transparent;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
  outline: none;
  font-family: inherit;

  @include hover {
    & {
      background-color: var(--bg-hover-color);
      border-color: var(--border-secondary-color);

      .theme-preview {
        transform: scale(1.04);
      }
    }
  }

  &.is-active {
    background-color: var(--bg-secondary-color);
    border-color: var(--border-pressed-color);
  }

  &--custom {
    cursor: pointer;
  }
}

.theme-preview {
  width: 36px;
  height: 24px;
  border-radius: var(--r-2xs);
  border: 1px solid var(--border-secondary-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 2px;
  gap: 2px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  .preview-mini-header {
    height: 4px;
    border-radius: 1px;
    width: 100%;
  }

  .preview-mini-body {
    flex: 1;
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .mini-bar {
    height: 8px;
    border-radius: 1px;
    flex: 1;

    &--short {
      flex: 0.4;
    }
  }

  &--light {
    background: #faf4f2;
    border-color: rgba(41, 36, 42, 0.15);

    .preview-mini-header {
      background: #e16032;
    }

    .mini-bar {
      background: #fce9e4;

      &--short {
        background: #f37a51;
      }
    }
  }

  &--dark {
    background: #181a20;
    border-color: rgba(255, 255, 255, 0.15);

    .preview-mini-header {
      background: #384158;
    }

    .mini-bar {
      background: #252a3a;

      &--short {
        background: #4a5578;
      }
    }
  }

  &--custom {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    border-color: rgba(255, 255, 255, 0.25);

    .preview-mini-header {
      background: rgba(255, 255, 255, 0.85);
    }

    .mini-bar {
      background: rgba(255, 255, 255, 0.7);

      &--short {
        background: rgba(255, 255, 255, 0.5);
      }
    }
  }
}

.theme-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  .theme-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    line-height: 1.2;
  }
}

.theme-option.is-active .theme-info .theme-name {
  font-weight: 600;
  color: var(--fg-accent-color);
}

.theme-action,
.theme-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  .check-icon {
    font-size: 1.15rem;
    color: var(--fg-accent-color);
  }
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--r-2xs);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;

  @include hover {
    & {
      background-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
      border-color: var(--fg-accent-color);
      transform: scale(1.08);

      .gear-icon {
        transform: rotate(60deg);
      }
    }
  }

  .gear-icon {
    font-size: 0.95rem;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

@keyframes themePopoverFadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes themePopoverSlideDown {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes themePopoverSlideUp {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
