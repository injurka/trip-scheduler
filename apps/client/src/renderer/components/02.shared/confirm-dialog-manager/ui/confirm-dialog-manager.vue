<script setup lang="ts">
import { KitConfirmDialog } from '~/components/01.kit/kit-confirm-dialog/ui'
import { useConfirmDialogStore } from '~/shared/store/confirm-dialog.store'

const confirmStore = useConfirmDialogStore()
</script>

<template>
  <KitConfirmDialog
    :open="confirmStore.isOpen"
    :title="confirmStore.title"
    :description="confirmStore.description"
    :confirm-text="confirmStore.confirmText"
    :type="confirmStore.type"
    @confirm="confirmStore._confirm"
    @cancel="confirmStore._cancel"
  />
</template>
