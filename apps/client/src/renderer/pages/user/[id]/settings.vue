<script setup lang="ts">
import { SettingsView } from '~/components/05.modules/account/settings'
</script>

<template>
  <section class="content-wrapper">
    <SettingsView />
  </section>
</template>

<style lang="scss" scoped>
.content-wrapper {
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 8px;
  padding-top: 32px;
}
</style>
