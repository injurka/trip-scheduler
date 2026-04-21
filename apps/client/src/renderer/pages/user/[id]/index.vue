<script setup lang="ts">
import { HighlightsFeedView } from '~/components/05.modules/account/highlights'
import { ProfileView } from '~/components/05.modules/account/profile'
</script>

<template>
  <section class="content-wrapper">
    <ProfileView />

    <!-- <HighlightsFeedView /> -->
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 8px;
}
</style>
