<script setup lang="ts">
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AppRoutePaths } from '~/shared/constants/routes'

const router = useRouter()

function goBack() {
  if (typeof window !== 'undefined' && window.history.state?.back) {
    router.back()
  }
  else {
    void router.push(AppRoutePaths.Root)
  }
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
