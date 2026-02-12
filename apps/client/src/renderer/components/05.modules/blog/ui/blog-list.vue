<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { AppRouteNames } from '~/shared/constants/routes'
import { useBlogStore } from '../store/blog.store'
import BlogCard from './blog-card.vue'

const storeBlog = useBlogStore()
const store = useAppStore(['auth'])
const router = useRouter()

const canCreate = computed(() => store.auth.user?.role === 'admin' || true)

onMounted(() => {
  storeBlog.fetchList()
})
</script>

<template>
  <div class="blog-list-container">
    <div v-if="canCreate" class="admin-controls">
      <KitBtn icon="mdi:plus" @click="router.push({ name: AppRouteNames.BlogCreate })">
        Создать новость
      </KitBtn>
    </div>

    <AsyncStateWrapper
      :loading="storeBlog.isLoadingList && storeBlog.list.length === 0"
      :data="storeBlog.list.length > 0 ? storeBlog.list : null"
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
.blog-list-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.admin-controls {
  display: flex;
  justify-content: flex-end;
}

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
