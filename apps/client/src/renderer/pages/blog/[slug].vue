<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import { formatDate } from '~/shared/lib/date-time'

const route = useRoute()
const store = useBlogStore()
const slug = route.params.slug as string

onMounted(() => {
  store.fetchBySlug(slug)
})
</script>

<template>
  <div class="content-wrapper">
    <NavigationBack />

    <AsyncStateWrapper
      :loading="store.isLoadingDetail"
      :data="store.currentPost"
    >
      <template #success="{ data }">
        <article class="article">
          <header class="article-header">
            <span class="date">{{ formatDate(data.publishedAt, { dateStyle: 'long' }) }}</span>
            <h1>{{ data.title }}</h1>
          </header>

          <div v-if="data.coverImage" class="cover-image">
            <img :src="data.coverImage" :alt="data.title">
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

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.article-content {
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--fg-primary-color);
}
</style>
