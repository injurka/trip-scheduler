<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import BlogCard from '~/components/05.modules/blog/ui/blog-card.vue'
import { AppRouteNames } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

const store = useBlogStore()
const authStore = useAuthStore()
const router = useRouter()

const canEdit = computed(() => authStore.user?.role === 'admin')

onMounted(() => {
  store.fetchList()
})
</script>

<template>
  <section class="content-wrapper">
    <div class="page-header">
      <div class="header-top">
        <NavigationBack />
        <KitBtn
          v-if="canEdit"
          icon="mdi:plus"
          size="sm"
          @click="router.push({ name: AppRouteNames.BlogCreate })"
        >
          Создать
        </KitBtn>
      </div>

      <h1>Новости</h1>
      <p>Официальные новости, обновления и полезные статьи от команды разработчиков.</p>
    </div>

    <AsyncStateWrapper
      :loading="store.isLoadingList && store.list.length === 0"
      :data="store.list.length > 0 ? store.list : null"
    >
      <template #loading>
        <div class="grid-skeleton">
          <!-- Скелетоны для загрузки -->
          <div v-for="i in 6" :key="i" class="skeleton-card" />
        </div>
      </template>

      <template #success="{ data }">
        <div class="blog-grid">
          <BlogCard v-for="post in data" :key="post.id" :post="post" />
        </div>
      </template>

      <template #empty>
        <div class="empty">
          Статей пока нет
        </div>
      </template>
    </AsyncStateWrapper>
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.grid-skeleton {
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
