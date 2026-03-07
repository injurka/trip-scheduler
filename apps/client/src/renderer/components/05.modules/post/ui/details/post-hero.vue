<script setup lang="ts">
import type { PostDetail } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitImage } from '~/components/01.kit/kit-image'

interface IProps {
  post: PostDetail
}

defineProps<IProps>()
</script>

<template>
  <div class="post-hero">
    <div class="hero-bg">
      <KitImage :src="post.media?.[0]?.url" object-fit="cover" />
    </div>

    <div class="hero-content">
      <div class="tags">
        <span v-if="post.city" class="tag-geo"><Icon icon="mdi:map-marker" /> {{ post.city }}</span>
        <!-- Категории больше нет -->
      </div>

      <h1 class="hero-title">
        {{ post.title }}
      </h1>

      <div class="author-row">
        <KitAvatar :src="post.user.avatarUrl" :name="post.user.name" size="28" />
        <span class="author-name">by {{ post.user.name }}</span>
      </div>

      <div class="stats-bar">
        <div class="stat-item">
          <Icon icon="mdi:eye-outline" />
          <span>{{ post.statsDetail?.views || 0 }}</span>
        </div>

        <div v-if="post.statsDetail?.duration " class="stat-item">
          <Icon icon="mdi:clock-outline" />
          <span>{{ post.statsDetail.duration }}</span>
        </div>

        <div v-if="post.statsDetail?.budget " class="stat-item">
          <Icon icon="mdi:wallet-outline" />
          <span>{{ post.statsDetail.budget }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-hero {
  position: relative;
  height: 400px;
  width: 100%;
  overflow: hidden;
  border-radius: 0 0 var(--r-xl) var(--r-xl);
  display: flex;
  align-items: flex-end;
  margin-bottom: 24px;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.8));
    backdrop-filter: blur(2px);
  }

  :deep(.kit-image-container) {
    height: 100%;
  }
}

.hero-content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 24px;
  color: white;
  max-width: 800px;
  margin: 0 auto;
}

.tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-geo {
  font-size: 0.8rem;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.hero-title {
  font-size: 2.5rem;
  line-height: 1.1;
  font-weight: 800;
  margin: 0 0 16px 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 0.9rem;
  opacity: 0.9;

  :deep(.kit-avatar) {
    height: 24px;
    width: 24px;
    border: none;
    font-size: 0.7rem;
  }
}

.stats-bar {
  display: flex;
  gap: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 16px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95rem;
    font-weight: 500;
  }
}

@media (max-width: 600px) {
  .hero-title {
    font-size: 2rem;
  }
  .post-hero {
    height: 400px;
    border-radius: 0;
  }
}
</style>
