<script setup>
import { ConfirmDialogManager } from '~/components/02.shared/confirm-dialog-manager'
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
</script>

<template>
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
