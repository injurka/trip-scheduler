<script lang="ts" setup>
import { BackgroundEffects } from '~/components/shared/background-effects'
import { Footer } from '~/components/shared/base-footer'

import { Header } from '~/components/shared/base-header'
</script>

<template>
  <!-- eslint-disable vue/no-multiple-template-root -->
  <Header />

  <main class="main">
    <div class="main-content">
      <slot />
    </div>

    <BackgroundEffects />

    <Footer />
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
