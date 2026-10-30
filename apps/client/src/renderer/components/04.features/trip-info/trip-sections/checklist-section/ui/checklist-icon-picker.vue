<script setup lang="ts">
import { IconPicker } from '~/components/02.shared/icon-picker'

interface Props { disabled?: boolean }

const props = defineProps<Props>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <IconPicker
    v-model="model"
    :disabled="props.disabled"
    size="sm"
    align="start"
    :chevron="false"
  />
</template>
