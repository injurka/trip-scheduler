<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useAppUpdateStore } from '~/shared/store/app-update.store'

const appUpdateStore = useAppUpdateStore()
const { hasUpdate, latestVersion } = storeToRefs(appUpdateStore)
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="hasUpdate"
        class="app-update-prompt"
        role="alert"
      >
        <div class="prompt-icon">
          <Icon icon="solar:download-square-bold" />
        </div>
        <div class="prompt-content-wrapper">
          <div class="prompt-message">
            <h4 class="prompt-title">
              Доступно обновление v{{ latestVersion }}
            </h4>
            <p class="prompt-description">
              Доступна новая версия приложения. Хотите скачать и установить обновление?
            </p>
          </div>
          <div class="prompt-actions">
            <KitBtn
              icon="mdi:download"
              color="primary"
              @click="appUpdateStore.startUpdate()"
            >
              Скачать
            </KitBtn>
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="appUpdateStore.closePrompt()"
            >
              Закрыть
            </KitBtn>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.app-update-prompt {
  position: fixed;
  right: var(--p-l, 20px);
  bottom: var(--p-l, 20px);
  display: flex;
  align-items: flex-start;
  gap: var(--p-m, 16px);
  padding: 16px;
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  z-index: 10001;
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  box-shadow: 0 8px 32px var(--bg-overlay-primary-color);
  max-width: 480px;
  backdrop-filter: blur(8px);

  @include media-down(sm) {
    flex-direction: column;
    right: var(--p-s, 12px);
    left: var(--p-s, 12px);
    bottom: var(--p-s, 12px);
    max-width: calc(100% - 24px);
  }
}

.prompt-icon {
  font-size: 2rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
  margin-top: 2px;
}

.prompt-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--p-s, 12px);
  flex-grow: 1;
  width: 100%;
}

.prompt-message {
  flex-grow: 1;
}

.prompt-title {
  margin: 0 0 4px 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.prompt-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.prompt-actions {
  display: flex;
  gap: var(--p-xs, 8px);
  align-self: flex-end;

  @include media-down(xs) {
    width: 100%;
    flex-direction: column;
    align-self: stretch;

    .kit-btn {
      width: 100%;
    }
  }
}
</style>
