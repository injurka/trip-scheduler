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

:deep(.article-content) {
  line-height: 1.7;
  color: var(--fg-primary-color);
  font-size: 1.05rem;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--fg-primary-color);
  }
  h1 {
    font-size: 2rem;
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 0.5rem;
  }
  h2 {
    font-size: 1.5rem;
    border: none;
    border-left: 4px solid var(--fg-accent-color);
    background: linear-gradient(90deg, rgba(var(--bg-accent-color-rgb), 0.5) 0%, transparent 100%);
    padding: 0.5rem 1rem;
    border-radius: 0 8px 8px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h3 {
    font-size: 1.25rem;
    border: none;
    border-bottom: 2px solid var(--border-secondary-color);
    padding-bottom: 0.3rem;
    width: fit-content;
    padding-right: 20px;
  }
  p {
    margin-bottom: 1.2rem;
  }
  p + ul {
    padding-top: 0;
  }
  strong {
    color: var(--fg-primary-color);
    font-weight: 700;
  }
  a {
    color: var(--fg-accent-color);
    font-weight: 500;
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--fg-accent-color-rgb), 0.4);
    transition: all 0.2s ease-in-out;

    &:hover {
      background-color: rgba(var(--fg-accent-color-rgb), 0.1);
      border-bottom-color: var(--fg-accent-color);
    }
  }
  em {
    color: var(--fg-accent-color);
    font-style: italic;
  }
  code:not(pre > code) {
    background-color: rgba(var(--fg-accent-color-rgb), 0.1);
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.2);
    color: var(--fg-accent-color);
    padding: 0.1em 0.4em;
    margin: 0 0.1em;
    font-size: 0.9em;
    border-radius: 6px;
    font-family: 'Maple Mono CN', 'JetBrains Mono', monospace;
    font-weight: 600;
    vertical-align: baseline;
    display: inline-block;
  }
  ul,
  ol {
    padding-left: 1.5rem;
    margin-bottom: 1.5rem;
    > li {
      ul {
        margin: 0;
      }
    }
  }
  ul > li {
    list-style-type: disc;
    margin-bottom: 0.5rem;
    &::marker {
      color: var(--fg-accent-color);
    }
  }
  blockquote {
    border-left: 4px solid var(--fg-accent-color);
    background-color: var(--bg-secondary-color);
    padding: 1rem 1.5rem;
    border-radius: 0 8px 8px 0;
    margin: 1.5rem 0;
    font-style: italic;
    color: var(--fg-secondary-color);
    p {
      margin: 0;
    }
  }
  img {
    border-radius: 8px;
    max-width: 100%;
    height: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    margin: 1rem 0;
  }
}
</style>
