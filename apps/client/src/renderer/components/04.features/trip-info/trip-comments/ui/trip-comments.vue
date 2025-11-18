<script setup lang="ts">
import type { CommentParentType } from '~/shared/types/models/comment'
import { Icon } from '@iconify/vue'
import { useIntersectionObserver } from '@vueuse/core'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useTripCommentsStore } from '../store/trip-comments.store'
import CommentForm from './comment-form.vue'
import CommentItem from './comment-item.vue'

interface Props {
  parentId: string
  parentType: CommentParentType
}

const props = defineProps<Props>()

const commentsStore = useTripCommentsStore()
const authStore = useAuthStore()
const route = useRoute()

const comments = computed(() => commentsStore.getCommentsByParentId(props.parentId))
const collection = computed(() => commentsStore.getCommentCollectionByParentId(props.parentId))
const hasMore = computed(() => collection.value?.hasMore ?? false)

const loadMoreTrigger = ref<HTMLElement | null>(null)
const asyncWrapper = ref<HTMLElement | null>(null)

useIntersectionObserver(
  loadMoreTrigger,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasMore.value && !commentsStore.isLoadingMore) {
      commentsStore.fetchMoreComments(props.parentId)
    }
  },
)

function handleAddComment(text: string) {
  commentsStore.addComment(text, props.parentId, props.parentType)
}

watch(comments, async (newComments, oldComments) => {
  if (asyncWrapper.value) {
    if (!oldComments || newComments.length > oldComments.length) {
      await nextTick()
      asyncWrapper.value.scrollTop = asyncWrapper.value.scrollHeight
    }
  }
}, { deep: true })
</script>

<template>
  <div class="comments-section">
    <AsyncStateWrapper
      ref="asyncWrapper"
      :loading="commentsStore.isLoading && comments.length === 0"
      :data="comments.length > 0 ? comments : null"
      class="async-wrapper"
    >
      <template #loading>
        <div class="loading-state">
          Загрузка комментариев...
        </div>
      </template>
      <template #success="{ data }">
        <div class="comments-list">
          <div v-if="hasMore" ref="loadMoreTrigger" class="load-more-trigger">
            <span v-if="commentsStore.isLoadingMore">Загрузка...</span>
          </div>
          <CommentItem
            v-for="comment in data"
            :key="comment.id"
            :comment="comment"
            @delete="commentsStore.deleteComment(comment.id, parentId)"
          />
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <Icon icon="mdi:message-text-outline" />
          <p>Комментариев пока нет.</p>
          <span v-if="authStore.isAuthenticated">Будьте первым, кто оставит комментарий!</span>
        </div>
      </template>
    </AsyncStateWrapper>

    <CommentForm
      v-if="authStore.isAuthenticated"
      @submit="handleAddComment"
    />
    <div v-else class="unauthorized-placeholder">
      <Icon icon="mdi:lock-outline" />
      <p>
        <router-link :to="{ path: AppRoutePaths.Auth.SignIn, query: { returnUrl: route.fullPath } }">
          Войдите
        </router-link>
        , чтобы оставлять комментарии.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.comments-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--r-s);
  height: 100%;
}

.async-wrapper {
  flex-grow: 1;
  overflow-y: auto;
  min-height: 100px;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}

.load-more-trigger {
  text-align: center;
  padding: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  height: 30px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  margin: auto;
  .iconify {
    font-size: 2.5rem;
    margin-bottom: 8px;
    opacity: 0.7;
  }
  p {
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--fg-primary-color);
  }
  span {
    font-size: 0.85rem;
  }
}

.unauthorized-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  color: var(--fg-secondary-color);
  margin: 8px 0;

  .iconify {
    font-size: 1.8rem;
    margin-bottom: 8px;
  }

  p {
    margin: 0;
    font-size: 0.9rem;

    a {
      color: var(--fg-accent-color);
      font-weight: 500;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
