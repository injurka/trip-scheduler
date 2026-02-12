<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitWipBadge } from '~/components/01.kit/kit-wip-badge'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { PostCard } from '~/components/05.modules/post'
import { usePostStore } from '~/components/05.modules/post/store/post.store'
import PostFilters from '~/components/05.modules/post/ui/feed/post-filters.vue'

const router = useRouter()
const store = usePostStore()
const confirm = useConfirm()

const { posts } = storeToRefs(store)

function handleCardClick(id: string) {
  router.push(AppRoutePaths.Post.Details(id))
}

function handleToggleLike(id: string) {
  store.toggleLike(id)
}

function handleCreate() {
  router.push(AppRoutePaths.Post.Create)
}

function handleToggleSave(id: string) {
  store.toggleSave(id)
}

function handleEdit(id: string) {
  router.push(AppRoutePaths.Post.Edit(id))
}

async function handleDelete(id: string) {
  const isConfirmed = await confirm({
    title: 'Вы уверены, что хотите удалить этот пост?',
    description: 'Это действие необратимо.',
    type: 'danger',
    confirmText: 'Да, удалить',
  })

  if (isConfirmed) {
    store.deletePost(id)
  }
}

onMounted(() => {
  store.fetchPosts(true)
})
</script>

<template>
  <section class="content-wrapper">
    <KitWipBadge />

    <div class="page-header-row">
      <div class="left">
        <NavigationBack />
      </div>
      <KitBtn icon="mdi:plus" size="sm" variant="tonal" @click="handleCreate">
        Создать
      </KitBtn>
    </div>

    <div class="page-header">
      <h1>Истории и маршруты</h1>
      <p>Читайте рассказы других путешественников и делитесь своими впечатлениями.</p>
    </div>

    <PostFilters />

    <div class="feed-container">
      <TransitionGroup name="list">
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @click-card="handleCardClick"
          @toggle-like="handleToggleLike"
          @toggle-save="handleToggleSave"
          @edit="handleEdit"
          @delete="handleDelete"
        />
      </TransitionGroup>

      <div v-if="posts.length === 0 && !store.isLoading" class="empty-feed">
        <div v-if="store.filters.tab === 'saved'" class="empty-content">
          <Icon icon="mdi:bookmark-outline" width="48" height="48" />
          <p>У вас пока нет сохраненных постов.</p>
        </div>
        <div v-else class="empty-content">
          <Icon icon="mdi:magnify-remove-outline" width="48" height="48" />
          <p>Ничего не найдено.</p>
          <KitBtn variant="tonal" @click="store.setSearch('')">
            Сбросить поиск
          </KitBtn>
        </div>
      </div>

      <div v-if="posts.length > 0 && !store.nextCursor" class="load-more">
        <p>Вы посмотрели все актуальное!</p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
}

.feed-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-feed {
  display: flex;
  justify-content: center;
  padding: 40px 0;

  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--fg-tertiary-color);
    gap: 8px;
  }
}

.load-more {
  text-align: center;
  padding: 32px 0;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
