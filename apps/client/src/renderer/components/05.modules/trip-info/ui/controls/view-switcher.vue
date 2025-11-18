<script setup lang="ts">
import type { ActiveView } from '../../models/types'
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const store = useModuleStore(['ui'])
const { activeView } = storeToRefs(store.ui)

const views: ViewSwitcherItem[] = [
  { id: 'plan', label: 'План', icon: 'mdi:clipboard-text-outline' },
  { id: 'memories', label: 'Воспоминания', icon: 'mdi:camera-iris' },
]

function handleViewChange(viewId: string) {
  store.ui.setActiveView(viewId as ActiveView)
}
</script>

<template>
  <KitViewSwitcher
    v-model="activeView"
    :items="views"
    @change="handleViewChange"
  />
</template>
