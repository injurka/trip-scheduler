<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { ToastItem } from '~/components/01.kit/kit-toast/ui'
import { useToastStore } from '~/shared/store/toast.store'

const toastStore = useToastStore()

const { allMessages } = storeToRefs(toastStore)

const { remove } = toastStore
</script>

<template>
  <TransitionGroup
    tag="div"
    class="kit-toast-container"
    name="kit-toast-fade"
  >
    <ToastItem
      v-for="msg in allMessages"
      :key="msg.id"
      :message="msg"
      @remove="remove(msg.id)"
    />
  </TransitionGroup>
</template>

<style lang="scss">
.kit-toast-container {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
  width: 350px;
}

.kit-toast-fade-move,
.kit-toast-fade-enter-active,
.kit-toast-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.55, 0, 0.1, 1);
}

.kit-toast-fade-enter-from,
.kit-toast-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) translateX(30px);
}

.kit-toast-fade-leave-active {
  position: absolute;
  width: 100%;
}
</style>
