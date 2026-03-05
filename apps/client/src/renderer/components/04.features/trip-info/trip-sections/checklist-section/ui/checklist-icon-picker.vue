<script setup lang="ts">
import { IconPicker } from '~/components/02.shared/icon-picker'

const props = defineProps<{ disabled?: boolean }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <IconPicker
    v-model="model"
    :disabled="props.disabled"
    size="sm"
    align="start"
  />
</template>
