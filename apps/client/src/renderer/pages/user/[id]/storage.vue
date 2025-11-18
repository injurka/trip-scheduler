<script setup lang="ts">
import { StorageView } from '~/components/05.modules/account/storage'
</script>

<template>
  <section class="content-wrapper">
    <StorageView />
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
