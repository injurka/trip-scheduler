<script setup lang="ts">
import { onMounted } from 'vue'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useBlogStore } from '../store/blog.store'
import BlogCard from './blog-card.vue'

const store = useBlogStore()

onMounted(() => {
  store.fetchList()
})
</script>

<template>
  <div class="blog-list-container">
    <AsyncStateWrapper
      :loading="store.isLoadingList && store.list.length === 0"
      :data="store.list.length > 0 ? store.list : null"
    >
      <template #loading>
        <div class="grid">
          <div v-for="i in 6" :key="i" class="skeleton-card" />
        </div>
      </template>

      <template #success="{ data }">
        <div class="grid">
          <BlogCard
            v-for="post in data"
            :key="post.id"
            :post="post"
          />
        </div>
      </template>

      <template #empty>
        <div class="empty">
          <p>Новостей пока нет.</p>
        </div>
      </template>
    </AsyncStateWrapper>
  </div>
</template>

<style scoped lang="scss">
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.skeleton-card {
  height: 380px;
  background: var(--bg-secondary-color);
  border-radius: var(--r-l);
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--fg-secondary-color);
}
</style>
