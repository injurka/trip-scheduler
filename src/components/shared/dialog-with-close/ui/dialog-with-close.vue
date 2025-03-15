<script lang="ts" setup>
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'

interface Props {
  maxWidth?: number
}

const { maxWidth = 700 } = defineProps<Props>()
const emits = defineEmits<{ afterLeave: [void] }>()

const maxWidthPx = computed(() => `${maxWidth + 48}px`)

const dialog = defineModel<boolean>({ required: true })

function onHide() {
  emits('afterLeave')
}
</script>

<template>
  <Dialog
    v-model:visible="dialog"
    :style="{ maxWidth: maxWidthPx }"
    class="dialog"
    modal
    :dismissable-mask="true"
    @after-hide="onHide"
  >
    <slot />
    <Button
      class="close"
      icon="pi pi-times"
      aria-label="Закрыть"
      text
      rounded
      @click="dialog = false"
    />
  </Dialog>
</template>

<style lang="scss" scoped>
.dialog {
  :deep(.p-dialog-content) {
    position: relative;
  }

  .close {
    position: absolute;
    right: -8px;
    top: -8px;
    width: 32px;
    height: 32px;
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 50%;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
