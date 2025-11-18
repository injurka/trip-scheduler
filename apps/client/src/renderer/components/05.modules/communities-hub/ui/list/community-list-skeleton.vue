<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div v-for="i in 3" :key="i" class="card-skeleton">
    <KitSkeleton height="120px" />
    <div class="content-skeleton">
      <KitSkeleton width="60px" height="60px" border-radius="50%" class="avatar-skeleton" />
      <KitSkeleton width="70%" height="24px" />
      <KitSkeleton width="90%" height="16px" />
      <KitSkeleton width="80%" height="16px" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card-skeleton {
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
}
.content-skeleton {
  padding: 1rem;
  padding-top: calc(1rem + 30px);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.avatar-skeleton {
  position: absolute;
  top: -30px;
  left: 1rem;
}
</style>
