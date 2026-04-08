<script setup lang="ts">
import { IconPicker } from '~/components/02.shared/icon-picker'

interface Props {
  disabled?: boolean
}

const props = defineProps<Props>()

const model = defineModel<string>({ required: true })
const { smAndDown: isMobile } = useDisplay()
</script>

<template>
  <IconPicker
    v-model="model"
    :mode="isMobile ? 'modal' : 'dropdown'"
    :disabled="props.disabled"
    size="lg"
    align="center"
  />
</template>
