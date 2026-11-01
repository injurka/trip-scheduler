<script setup lang="ts">
import { OnboardingView } from '~/components/05.modules/onboarding'
</script>

<template>
  <div class="content-wrapper onboarding-page-wrapper">
    <OnboardingView />
  </div>
</template>

<style scoped lang="scss">
.onboarding-page-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
