<script setup lang="ts">
import type { MetroSystemDetails } from '../lib/metro-route'
import type { MetroRide } from '~/shared/types/models/activity'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import MetroMap from './metro-map.vue'

interface Props {
  system: MetroSystemDetails | null
  rides: MetroRide[]
}

defineProps<Props>()
const visible = defineModel<boolean>('visible', { required: true })
</script>

<template>
  <KitDialogWithClose
    v-model:visible="visible"
    :title="`Метро · ${system?.city || ''}`"
    :max-width="1040"
    content-class="metro-map-dialog"
  >
    <MetroMap :system="system" :rides="rides" :active="visible" />
  </KitDialogWithClose>
</template>
