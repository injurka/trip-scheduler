<script setup>
import { useHead, useSeoMeta } from '@vueuse/head'
import { ConfirmDialogManager } from '~/components/02.shared/confirm-dialog-manager'
import { OfflineBanner } from '~/components/02.shared/offline-banner'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { ToastManager } from '~/components/02.shared/toast-manager'

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

const layout = computed(() => route.meta.layout || 'empty')
const transition = computed(() => route.meta.transition)

const layouts = {
  'default': DefaultLayout,
  'empty': EmptyLayout,
  'trip-info': TripInfoLayout,
}

// --- SEO Конфигурация ---
const siteUrl = 'https://trip-scheduler.ru'
const siteName = 'TripScheduler'
const description = 'Планируйте свои путешествия легко. Создавайте маршруты, сохраняйте воспоминания, управляйте бюджетом и списками вещей в одном месте.'

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} | ${siteName}` : `${siteName} - Планировщик путешествий`
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
        'url': siteUrl,
        'description': description,
        'applicationCategory': 'TravelApplication',
        'operatingSystem': 'Web, Windows, Linux',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'RUB',
        },
      }),
    },
  ],
})

// Исправление Meta Description и Social Tags
useSeoMeta({
  description,
  keywords: 'путешествия, планировщик, маршрут, trip planner, бюджет поездки, чек-лист, воспоминания',
  // Open Graph
  ogTitle: siteName,
  ogDescription: description,
  ogType: 'website',
  ogUrl: computed(() => `${siteUrl}${route.path}`),
  ogImage: `${siteUrl}/og-image.jpg`,
  ogSiteName: siteName,
  // Twitter
  twitterCard: 'summary_large_image',
  twitterTitle: siteName,
  twitterDescription: description,
  twitterImage: `${siteUrl}/og-image.jpg`,
})
</script>

<template>
  <OfflineBanner />

  <component :is="layouts[layout]">
    <router-view v-slot="{ Component }">
      <transition v-if="transition" :name="transition" mode="out-in">
        <component :is="Component" />
      </transition>

      <component :is="Component" v-else />
    </router-view>
  </component>

  <ReloadPrompt />
  <ToastManager />
  <ConfirmDialogManager />
</template>
