<script setup lang="ts">
import { IconPicker } from '~/components/02.shared/icon-picker'

interface Props {
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  chevron?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
  chevron: false,
})

const model = defineModel<string>({ required: true })
const { smAndDown: isMobile } = useDisplay()
</script>

<template>
  <IconPicker
    v-model="model"
    :mode="isMobile ? 'modal' : 'dropdown'"
    :disabled="props.disabled"
    :size="props.size"
    :chevron="props.chevron"
    align="center"
  />
</template>
