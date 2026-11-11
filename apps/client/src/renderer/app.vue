<script setup>
import { useHead, useSeoMeta } from '@vueuse/head'
import { ConfigProvider } from 'reka-ui'
import { AppUpdatePrompt } from '~/components/02.shared/app-update-prompt'
import { ConfirmDialogManager } from '~/components/02.shared/confirm-dialog-manager'
import { OfflineBanner } from '~/components/02.shared/offline-banner'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { ToastManager } from '~/components/02.shared/toast-manager'
import { useKeyboardAwareLayout } from '~/shared/composables/use-keyboard-aware-layout'
import { useOnboarding } from '~/shared/composables/use-onboarding'
import { AppRouteNames, AppRoutePaths } from '~/shared/constants/routes'
import { useConnectivity } from '~/shared/lib/connectivity'
import { lazyComponent } from '~/shared/lib/lazy-component'
import { useAuthStore } from '~/shared/store/auth.store'
import '~/assets/scss/global.scss'
import '~/assets/scss/atomic.scss'
import '~/assets/scss/normalize.scss'
import '~/assets/scss/animation.scss'
import '~/assets/scss/fonts.scss'
import 'maplibre-gl/dist/maplibre-gl.css'
import '~/assets/scss/maplibre-markers.scss'

const { isOnline } = useConnectivity()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const onboarding = useOnboarding()

const OfflineProgressDialog = lazyComponent(() => import('~/components/02.shared/offline-manager/ui/offline-progress-dialog.vue'))
const DefaultLayout = lazyComponent(() => import('~/components/06.layouts/default/ui/layout.vue'))
const EmptyLayout = lazyComponent(() => import('~/components/06.layouts/empty/ui/layout.vue'))
const TripInfoLayout = lazyComponent(() => import('~/components/06.layouts/trip-info/ui/layout.vue'))
const layouts = {
  'default': DefaultLayout,
  'empty': EmptyLayout,
  'trip-info': TripInfoLayout,
}
const siteUrl = 'https://trip-scheduler.ru'
const siteName = 'Trip Scheduler'
const description = 'Trip Scheduler — удобный планировщик путешествий. Создавайте маршруты, сохраняйте воспоминания и организуйте свои поездки в одном месте.'

const layout = computed(() => route.meta.layout || 'empty')
const transition = computed(() => route.meta.transition)

// Keyboard-Aware Layout: геометрия видимой области над экранной клавиатурой
// и минимальная прокрутка активного поля. Подключается один раз на всё приложение.
useKeyboardAwareLayout()
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} | ${siteName}`
      : `${siteName} — Планировщик путешествий и маршрутов`
  },
  htmlAttrs: {
    'lang': 'ru',
    'data-offline': computed(() => String(!isOnline.value)),
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

onMounted(async () => {
  await router.isReady()

  if (!route.path.startsWith('/auth') && route.name !== AppRouteNames.Onboarding && onboarding.initOnboarding()) {
    router.replace({ path: AppRoutePaths.Onboarding, query: { returnUrl: route.fullPath } })
  }
})
</script>

<template>
  <ConfigProvider :scroll-body="false">
    <OfflineBanner />

    <component
      :is="layouts[layout]"
      :key="`${layout}:${authStore.user?.id || 'guest'}`"
    >
      <router-view v-slot="{ Component }">
        <transition v-if="transition" :name="transition" mode="out-in">
          <component :is="Component" />
        </transition>

        <component :is="Component" v-else />
      </router-view>
    </component>

    <ReloadPrompt />
    <AppUpdatePrompt />
    <ToastManager />

    <ConfirmDialogManager />
    <OfflineProgressDialog />
  </ConfigProvider>
</template>

<style lang="scss">
#app {
  --offline-banner-height: 40px;
  --offline-banner-offset: 0px;

  padding-top: var(--offline-banner-offset);
}

html[data-offline='true'] #app {
  --offline-banner-offset: var(--offline-banner-height);
}

@media (max-width: 600px) {
  #app {
    --offline-banner-height: 36px;
  }
}
</style>
