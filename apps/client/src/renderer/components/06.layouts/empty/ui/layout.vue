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
  overflow: clip;
  padding-top: var(--safe-area-inset-top);
  padding-bottom: var(--safe-area-inset-bottom);
  min-height: 100dvh;
  box-sizing: border-box;
}

.main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}
</style>
