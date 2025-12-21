<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import { AppRouteNames } from '~/shared/constants/routes'
import { formatDate } from '~/shared/lib/date-time'
import { useAuthStore } from '~/shared/store/auth.store'

const route = useRoute()
const router = useRouter()
const store = useBlogStore()
const authStore = useAuthStore()
const confirm = useConfirm()

const slug = route.params.slug as string

const canEdit = computed(() => authStore.user?.role === 'admin' || false)

function handleEdit() {
  if (store.currentPost) {
    router.push({ name: AppRouteNames.BlogEdit, params: { id: store.currentPost.id } })
  }
}

async function handleDelete() {
  if (!store.currentPost)
    return

  const isConfirmed = await confirm({
    title: 'Удалить статью?',
    description: 'Это действие необратимо.',
    type: 'danger',
  })

  if (isConfirmed) {
    await store.deletePost(store.currentPost.id)
    await router.push({ name: AppRouteNames.BlogList })
  }
}

onMounted(() => {
  store.fetchBySlug(slug)
})
</script>

<template>
  <div class="content-wrapper">
    <div class="page-top-bar">
      <NavigationBack />
      <div v-if="canEdit && store.currentPost" class="admin-actions">
        <KitBtn variant="outlined" color="secondary" size="sm" @click="handleEdit">
          <Icon icon="mdi:pencil-outline" />
          Редактировать
        </KitBtn>
        <KitBtn variant="outlined" color="secondary" size="sm" class="delete-btn" @click="handleDelete">
          <Icon icon="mdi:trash-can-outline" />
        </KitBtn>
      </div>
    </div>

    <AsyncStateWrapper
      :loading="store.isLoadingDetail"
      :data="store.currentPost"
    >
      <template #success="{ data }">
        <article class="article">
          <header class="article-header">
            <span class="date">{{ data.publishedAt ? formatDate(data.publishedAt, { dateStyle: 'long' }) : '' }}</span>
            <h1>{{ data.title }}</h1>
          </header>

          <div v-if="data.coverImage" class="cover-image">
            <KitImage
              :src="data.coverImage"
              :alt="data.title"
              object-fit="cover"
            />
          </div>

          <div class="article-content">
            <KitInlineMdEditorWrapper
              :model-value="data.content"
              :readonly="true"
            />
          </div>
        </article>
      </template>
    </AsyncStateWrapper>
  </div>
</template>

<style scoped lang="scss">
.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
}

.page-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.admin-actions {
  display: flex;
  gap: 8px;

  .delete-btn:hover {
    color: var(--fg-error-color);
    border-color: var(--fg-error-color);
  }
}

.article-header {
  margin: 24px 0 32px;
  text-align: center;

  .date {
    color: var(--fg-accent-color);
    font-weight: 500;
    display: block;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 2.5rem;
    line-height: 1.2;
    margin: 0;
  }
}

.cover-image {
  width: 100%;
  height: 400px;
  border-radius: var(--r-l);
  overflow: hidden;
  margin-bottom: 40px;
}

.article-content {
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--fg-primary-color);
}
</style>
