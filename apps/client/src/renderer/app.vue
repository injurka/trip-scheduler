<script setup>
import { useHead, useSeoMeta } from '@vueuse/head'
import { AppTitleBar } from '~/components/02.shared/app-title-bar'
import { ConfirmDialogManager } from '~/components/02.shared/confirm-dialog-manager'
import { OfflineBanner } from '~/components/02.shared/offline-banner'
import { OfflineProgressDialog } from '~/components/02.shared/offline-manager'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { ToastManager } from '~/components/02.shared/toast-manager'

import { FloatingMap } from '~/components/04.features/floating-map'
import { DefaultLayout } from '~/components/06.layouts/default'
import { EmptyLayout } from '~/components/06.layouts/empty'
import { TripInfoLayout } from '~/components/06.layouts/trip-info'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import '~/assets/scss/global.scss'
import '~/assets/scss/atomic.scss'
import '~/assets/scss/normalize.scss'
import '~/assets/scss/animation.scss'
import '~/assets/scss/fonts.scss'

const route = useRoute()

// --- Electron Logic ---
const isElectron = typeof window !== 'undefined' && !!window.electronAPI
const titleBarHeight = isElectron ? '32px' : '0px'

const layout = computed(() => route.meta.layout || 'empty')
const transition = computed(() => route.meta.transition)

const layouts = {
  'default': DefaultLayout,
  'empty': EmptyLayout,
  'trip-info': TripInfoLayout,
}

// --- SEO Конфигурация ---
const siteUrl = 'https://trip-scheduler.ru'
const siteName = 'Trip Scheduler'
const description = 'Trip Scheduler — удобный планировщик путешествий.'

useHead({
  titleTemplate: titleChunk => titleChunk ? `${titleChunk} | ${siteName}` : `${siteName}`,
  htmlAttrs: { lang: 'ru' },
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/trip-scheduler-logo.svg' }],
})

useSeoMeta({
  description,
  ogTitle: siteName,
  ogDescription: description,
})
</script>

<template>
  <div id="app-root" :style="{ '--title-bar-height': titleBarHeight }">
    <AppTitleBar />

    <div class="app-layout-wrapper">
      <OfflineBanner />

      <component :is="layouts[layout]">
        <router-view v-slot="{ Component }">
          <transition v-if="transition" :name="transition" mode="out-in">
            <component :is="Component" />
          </transition>
          <component :is="Component" v-else />
        </router-view>
      </component>
    </div>

    <FloatingMap />
    <ReloadPrompt />
    <ToastManager />
    <ConfirmDialogManager />
    <OfflineProgressDialog />
  </div>
</template>

<style lang="scss">
.app-layout-wrapper {
  padding-top: var(--title-bar-height);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
