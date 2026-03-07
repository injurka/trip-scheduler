<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'

const { smAndDown } = useDisplay()
</script>

<template>
  <div class="memories-skeleton">
    <div class="timeline-skeleton">
      <div v-for="i in 3" :key="i" class="group-skeleton">
        <div class="group-header">
          <KitSkeleton width="100px" height="24px" border-radius="6px" />
        </div>
        <div class="group-grid">
          <KitSkeleton
            v-for="j in 3"
            :key="j"
            width="100%"
            :height="smAndDown ? '180px' : '300px'"
            border-radius="12px"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-skeleton {
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.timeline-skeleton {
  display: flex;
  flex-direction: column;
}

.group-skeleton {
  position: relative;
  border-left: 2px solid var(--border-secondary-color);
  padding: 26px 0 24px 24px;

  &::before {
    content: '';
    position: absolute;
    left: -9px;
    top: 30px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: var(--bg-secondary-color);
    border: 3px solid var(--border-secondary-color);
  }

  @include media-down(sm) {
    padding: 26px 0 12px 12px;
  }
}

.group-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;

  @include media-down(sm) {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
}
</style>
