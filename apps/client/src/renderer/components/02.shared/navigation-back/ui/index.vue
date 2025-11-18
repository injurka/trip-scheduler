<script setup lang="ts">
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <div class="navigation-back-container">
    <KitBtn
      class="navigation-back-btn"
      icon="mdi:arrow-left"
      variant="outlined"
      color="secondary"
      @click="goBack"
    >
      Назад
    </KitBtn>
  </div>
</template>

<style scoped lang="scss">
.navigation-back-container {
  display: flex;
  margin-bottom: 8px;
}

.navigation-back-btn {
  border: 1px solid transparent !important;
  opacity: 0.5;
  padding: 6px;

  &:hover {
    opacity: 1;
  }
}
</style>
