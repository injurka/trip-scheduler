<script setup>
import { useHead, useSeoMeta } from '@vueuse/head'
import { ConfigProvider } from 'reka-ui'
import { ConfirmDialogManager } from '~/components/02.shared/confirm-dialog-manager'
import { OfflineBanner } from '~/components/02.shared/offline-banner'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { ToastManager } from '~/components/02.shared/toast-manager'
import { lazyComponent } from '~/shared/lib/lazy-component'
import { useLayoutStore } from '~/shared/store/layout.store'

import '~/assets/scss/global.scss'
import '~/assets/scss/atomic.scss'
import '~/assets/scss/normalize.scss'
import '~/assets/scss/animation.scss'
import '~/assets/scss/fonts.scss'

const OfflineProgressDialog = lazyComponent(() => import('~/components/02.shared/offline-manager/ui/offline-progress-dialog.vue'))
const FloatingMap = lazyComponent(() => import('~/components/04.features/floating-map/ui/floating-map.vue'))

const DefaultLayout = lazyComponent(() => import('~/components/06.layouts/default/ui/layout.vue'))
const EmptyLayout = lazyComponent(() => import('~/components/06.layouts/empty/ui/layout.vue'))
const TripInfoLayout = lazyComponent(() => import('~/components/06.layouts/trip-info/ui/layout.vue'))

const route = useRoute()
const layoutStore = useLayoutStore()

const layout = computed(() => route.meta.layout || 'empty')
const transition = computed(() => route.meta.transition)

const layouts = {
  'default': DefaultLayout,
  'empty': EmptyLayout,
  'trip-info': TripInfoLayout,
}

const siteUrl = 'https://trip-scheduler.ru'
const siteName = 'Trip Scheduler'
const description = 'Trip Scheduler — удобный планировщик путешествий. Создавайте маршруты, сохраняйте воспоминания и организуйте свои поездки в одном месте.'

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} | ${siteName}`
      : `${siteName} — Планировщик путешествий и маршрутов`
  },
  htmlAttrs: {
    lang: 'ru',
  },
  link: [
    {
      rel: 'canonical',
      href: computed(() => `${siteUrl}${route.path}`),
    },
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/trip-scheduler-logo.svg',
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': siteName,
        'alternateName': ['TripScheduler', 'Планировщик путешествий'],
        'url': siteUrl,
        'description': description,
        'applicationCategory': 'TravelApplication',
        'operatingSystem': 'Any',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'RUB',
        },
      }),
    },
  ],
})

useSeoMeta({
  description,
  keywords: 'путешествия, trip scheduler, планировщик, маршрут, trip planner, поездка, туризм',
  ogTitle: `${siteName} — Планировщик путешествий`,
  ogDescription: description,
  ogType: 'website',
  ogUrl: computed(() => `${siteUrl}${route.path}`),
  ogImage: `${siteUrl}/og-image.jpg`,
  ogSiteName: siteName,
  twitterCard: 'summary_large_image',
  twitterTitle: `${siteName} — Планировщик путешествий`,
  twitterDescription: description,
  twitterImage: `${siteUrl}/og-image.jpg`,
})
</script>

<template>
  <ConfigProvider :scroll-body="false">
    <OfflineBanner />

    <component :is="layouts[layout]">
      <router-view v-slot="{ Component }">
        <transition v-if="transition" :name="transition" mode="out-in">
          <component :is="Component" />
        </transition>

        <component :is="Component" v-else />
      </router-view>
    </component>

    <FloatingMap v-if="layoutStore.isFloatingMapOpen" />
    <ReloadPrompt />
    <ToastManager />

    <ConfirmDialogManager />
    <OfflineProgressDialog />
  </ConfigProvider>
</template>
