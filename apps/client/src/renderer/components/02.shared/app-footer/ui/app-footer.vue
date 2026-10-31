<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { AppRouteNames } from '~/shared/constants/routes'
import { isMobile, isTauri } from '~/shared/lib/env'
import { useAppUpdateStore } from '~/shared/store/app-update.store'

const route = useRoute()
const appUpdateStore = useAppUpdateStore()

const isDownloading = ref(false)

const appVersion = computed(() => appUpdateStore.latestVersion)
const currentDeepLink = computed(() => {
  const path = route.fullPath.replace(/^\/+/, '')

  return `trip-scheduler://${path}`
})
const downloadButtonShortLabel = computed(() => {
  const versionStr = appVersion.value ? ` v${appVersion.value}` : ''

  if (appUpdateStore.targetPlatform === 'linux') {
    return `AppImage${versionStr}`
  }

  if (appUpdateStore.targetPlatform === 'windows') {
    return `Windows${versionStr}`
  }

  return `APK${versionStr}`
})
const downloadButtonIcon = computed(() => {
  if (isDownloading.value) {
    return 'mdi:loading'
  }

  if (appUpdateStore.targetPlatform === 'linux') {
    return 'mdi:linux'
  }

  if (appUpdateStore.targetPlatform === 'windows') {
    return 'mdi:microsoft-windows'
  }

  return 'mdi:android'
})
const bannerTitle = computed(() => {
  if (appUpdateStore.targetPlatform === 'linux') {
    return 'Десктопное приложение для Linux'
  }

  if (appUpdateStore.targetPlatform === 'windows') {
    return 'Десктопное приложение для Windows'
  }

  return 'Мобильное приложение TripScheduler'
})
const bannerDescription = computed(() => {
  if (appUpdateStore.targetPlatform === 'linux') {
    return 'Автономный режим, быстрый доступ и работа без браузера (AppImage)'
  }

  return 'Оффлайн-режим, фоновый GPS-трекинг маршрутов и уведомления'
})

async function handleDownloadApk() {
  try {
    isDownloading.value = true
    await appUpdateStore.downloadAppInBrowser()
  }
  finally {
    isDownloading.value = false
  }
}

onMounted(() => {
  if (!isTauri) {
    appUpdateStore.fetchLatestReleaseInfo().catch(() => {})
  }
})
</script>

<template>
  <footer class="app-footer">
    <div class="footer-dock">
      <div class="footer-left">
        <span class="copyright">© 2026 TripScheduler</span>

        <span class="divider-dot" />

        <nav class="legal-links">
          <router-link :to="{ name: AppRouteNames.Terms }" class="legal-link">
            Условия
          </router-link>
          <router-link :to="{ name: AppRouteNames.Privacy }" class="legal-link">
            Конфиденциальность
          </router-link>
          <router-link :to="{ name: AppRouteNames.OssLicenses }" class="legal-link">
            Лицензии OSS
          </router-link>
          <router-link :to="{ name: AppRouteNames.BlogList }" class="legal-link">
            Блог
          </router-link>
        </nav>
      </div>

      <span class="dock-divider" />

      <div class="footer-right">
        <!-- Компактная кнопка скачивания нативного приложения для веб-версии -->
        <KitTooltip
          v-if="!isTauri"
          :text="`${bannerTitle}: ${bannerDescription}`"
        >
          <button
            class="app-download-chip"
            :disabled="isDownloading"
            @click="handleDownloadApk"
          >
            <Icon
              :icon="downloadButtonIcon"
              class="app-chip-icon"
              :class="{ 'is-spinning': isDownloading }"
            />
            <span class="app-chip-text">{{ downloadButtonShortLabel }}</span>
          </button>
        </KitTooltip>

        <div class="footer-icons-group">
          <KitTooltip v-if="!isTauri && isMobile" text="Открыть страницу в приложении">
            <a
              :href="currentDeepLink"
              class="icon-link"
              title="Открыть в приложении"
            >
              <Icon icon="mdi:cellphone-link" />
            </a>
          </KitTooltip>

          <KitTooltip text="Полезные ссылки">
            <router-link
              :to="{ name: AppRouteNames.UsefulLinks }"
              class="icon-link"
              title="Полезные ссылки"
            >
              <Icon icon="mdi:link-variant" />
            </router-link>
          </KitTooltip>

          <KitTooltip text="О проекте">
            <router-link
              :to="{ name: AppRouteNames.About }"
              class="icon-link"
              title="О проекте"
            >
              <Icon icon="mdi:information-outline" />
            </router-link>
          </KitTooltip>

          <KitTooltip text="GitHub">
            <a
              href="https://github.com/injurkx/trip-scheduler"
              target="_blank"
              rel="noopener noreferrer"
              class="icon-link"
              title="GitHub"
            >
              <Icon icon="mdi:github" />
            </a>
          </KitTooltip>
        </div>
      </div>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.app-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 1rem calc(0.75rem + var(--safe-area-inset-bottom));
  z-index: 9;
  display: flex;
  justify-content: center;
  pointer-events: none;

  @include media-down(sm) {
    padding: 0 0.5rem calc(0.5rem + var(--safe-area-inset-bottom));
  }
}

.footer-dock {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  max-width: 100%;
  padding: 4px 14px;
  border-radius: 9999px;
  background-color: rgba(var(--bg-primary-color-rgb), 0.72);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.22);
  box-shadow:
    0 4px 20px -2px rgba(0, 0, 0, 0.12),
    0 2px 6px -1px rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;

  @include media-down(sm) {
    width: 100%;
    max-width: 480px;
    flex-direction: column;
    border-radius: 18px;
    padding: 10px 14px 8px;
    gap: 8px;
  }
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  @include media-down(sm) {
    order: 3;
    width: 100%;
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }
}

.copyright {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--fg-tertiary-color);
  white-space: nowrap;
  user-select: none;

  @include media-down(sm) {
    order: 2;
    font-size: 0.725rem;
    opacity: 0.75;
  }
}

.divider-dot {
  width: 3px;
  height: 3px;
  background-color: var(--fg-tertiary-color);
  border-radius: 50%;
  opacity: 0.5;
  flex-shrink: 0;

  @include media-down(sm) {
    display: none;
  }
}

.legal-links {
  display: flex;
  align-items: center;
  gap: 12px;

  @include media-down(sm) {
    order: 1;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
}

.legal-link {
  font-size: 0.775rem;
  color: var(--fg-secondary-color);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
  }

  @include media-down(sm) {
    font-size: 0.75rem;
  }
}

.dock-divider {
  width: 1px;
  height: 14px;
  background-color: rgba(var(--border-primary-color-rgb), 0.22);
  flex-shrink: 0;

  @include media-down(sm) {
    order: 2;
    width: 100%;
    height: 1px;
    opacity: 0.5;
  }
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @include media-down(sm) {
    order: 1;
    width: 100%;
    justify-content: space-between;
  }
}

.footer-icons-group {
  display: flex;
  align-items: center;
  gap: 6px;

  @include media-down(sm) {
    gap: 4px;
    margin-left: auto;

    &:only-child {
      margin-left: auto;
      margin-right: auto;
    }
  }
}

.app-download-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--accent-primary-color);
  background-color: rgba(var(--accent-primary-color-rgb), 0.1);
  border: 1px solid rgba(var(--accent-primary-color-rgb), 0.25);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: rgba(var(--accent-primary-color-rgb), 0.18);
    border-color: rgba(var(--accent-primary-color-rgb), 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .app-chip-icon {
    font-size: 0.95rem;
    flex-shrink: 0;

    &.is-spinning {
      animation: spin 1s linear infinite;
    }
  }

  .app-chip-text {
    line-height: 1;
  }
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--fg-secondary-color);
  background-color: transparent;
  transition: all 0.2s ease;
  font-size: 1.1rem;

  @include hover {
    & {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }
  }

  &:active {
    transform: scale(0.92);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
