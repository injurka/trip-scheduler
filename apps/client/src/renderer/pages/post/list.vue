<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { PostCard } from '~/components/05.modules/post'
import { usePostStore } from '~/components/05.modules/post/store/post.store'
import PostFilters from '~/components/05.modules/post/ui/feed/post-filters.vue'

const router = useRouter()
const postStore = usePostStore()

// Получаем отфильтрованные посты из стора
const posts = computed(() => postStore.filteredPosts)

function goToDetails(id: string) {
  router.push(`/post/${id}`)
}

function handleCreate() {
  router.push('/post/create')
}

// При клике на локацию в карточке — заполняем поиск
function handleLocationClick(loc: any) {
  postStore.setSearch(loc.city)
}
</script>

<template>
  <section class="content-wrapper">
    <!-- Header -->
    <div class="page-header-row">
      <div class="left">
        <NavigationBack />
      </div>
      <KitBtn icon="mdi:plus" size="sm" variant="tonal" @click="handleCreate">
        Создать
      </KitBtn>
    </div>

    <!-- Filters Panel -->
    <PostFilters />

    <!-- Feed List -->
    <div class="feed-container">
      <TransitionGroup name="list">
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @click-card="goToDetails"
          @toggle-like="postStore.toggleLike"
          @toggle-save="postStore.toggleSave"
          @click-location="handleLocationClick"
        />
      </TransitionGroup>

      <!-- Empty States -->
      <div v-if="posts.length === 0" class="empty-feed">
        <div v-if="postStore.filters.tab === 'saved'" class="empty-content">
          <Icon icon="mdi:bookmark-outline" size="48" />
          <p>У вас пока нет сохраненных постов.</p>
        </div>
        <div v-else class="empty-content">
          <Icon icon="mdi:magnify-remove-outline" size="48" />
          <p>Ничего не найдено.</p>
          <KitBtn variant="text" @click="postStore.setSearch('')">
            Сбросить поиск
          </KitBtn>
        </div>
      </div>

      <div v-if="posts.length > 0" class="load-more">
        <p>Вы посмотрели все актуальное!</p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
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

/* Animations for List */
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

/* Ensure items don't jump when removed */
.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
