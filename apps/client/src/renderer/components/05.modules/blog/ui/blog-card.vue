<script setup lang="ts">
import type { BlogListItems } from '~/shared/types/models/blog'
import { KitImage } from '~/components/01.kit/kit-image'
import { formatDate } from '~/shared/lib/date-time'

interface Props {
  post: BlogListItems
}

defineProps<Props>()
</script>

<template>
  <router-link :to="{ name: 'blog-article', params: { slug: post.slug } }" class="blog-card">
    <div class="image-wrapper">
      <KitImage
        v-if="post.coverImage"
        :src="post.coverImage"
        :alt="post.title"
        object-fit="cover"
      />
      <div v-else class="placeholder" />
    </div>
    <div class="content">
      <div class="date">
        {{ post.publishedAt ? formatDate(post.publishedAt, { dateStyle: 'medium' }) : '' }}
      </div>
      <h3 class="title">
        {{ post.title }}
      </h3>
      <p class="excerpt">
        {{ post.excerpt }}
      </p>
    </div>
  </router-link>
</template>

<style scoped lang="scss">
.blog-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  height: 100%;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-l);
    border-color: var(--border-primary-color);
  }
}

.image-wrapper {
  height: 200px;
  background: var(--bg-tertiary-color);
}

.placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, var(--bg-tertiary-color), var(--bg-secondary-color));
}

.content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.date {
  font-size: 0.85rem;
  color: var(--fg-tertiary-color);
}

.title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--fg-primary-color);
  line-height: 1.3;
}

.excerpt {
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
