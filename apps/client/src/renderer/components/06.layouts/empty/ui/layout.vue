<script lang="ts" setup>
import { BackgroundEffects } from '~/components/02.shared/background-effects'
</script>

<template>
  <main class="main">
    <div class="main-content">
      <slot />
    </div>

    <BackgroundEffects />
  </main>
</template>

<style scoped lang="scss">
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
}

.main-content {
  height: 100%;
  display: flex;
  flex: 1;
}
</style>
