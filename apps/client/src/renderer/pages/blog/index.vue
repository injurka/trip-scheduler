<script setup lang="ts">
import { onMounted } from 'vue'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import BlogCard from '~/components/05.modules/blog/ui/blog-card.vue'

const store = useBlogStore()

onMounted(() => {
  store.fetchList()
})
</script>

<template>
  <section class="content-wrapper">
    <div class="page-header">
      <NavigationBack />
      <h1>Блог Trip Scheduler</h1>
      <p>Официальные новости, обновления и полезные статьи от команды разработчиков.</p>
    </div>

    <AsyncStateWrapper
      :loading="store.isLoadingList && store.list.length === 0"
      :data="store.list.length > 0 ? store.list : null"
    >
      <template #loading>
        <div class="grid-skeleton">
          Loading...
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

.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--fg-secondary-color);
}
</style>
