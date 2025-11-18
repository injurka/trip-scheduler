<script setup lang="ts">
import type { Community } from '~/shared/types/models/community'
import { Icon } from '@iconify/vue'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitImage } from '~/components/01.kit/kit-image'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  community: Community
}
const props = defineProps<Props>()
const router = useRouter()

function goToCommunity() {
  router.push(AppRoutePaths.Communities.Info(props.community.id))
}
</script>

<template>
  <div class="community-card" @click="goToCommunity">
    <div class="card-cover">
      <KitImage
        v-if="community.coverImageUrl"
        :src="community.coverImageUrl"
        :alt="community.name"
      />
      <div v-else class="cover-placeholder">
        <Icon icon="mdi:image-area" />
      </div>
    </div>
    <div class="card-content">
      <KitAvatar
        :src="community.avatarUrl"
        :name="community.name"
        :size="60"
        class="community-avatar"
      />
      <h3 class="community-name">
        {{ community.name }}
      </h3>
      <p class="community-description">
        {{ community.description }}
      </p>
      <div class="card-footer">
        <div class="meta-item">
          <Icon icon="mdi:account-multiple-outline" />
          <span>{{ community._count?.members ?? 0 }} участников</span>
        </div>
        <div v-if="community.privacyType === 'private'" class="meta-item">
          <Icon icon="mdi:lock-outline" />
          <span>Приватное</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.community-card {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--s-l);
    border-color: var(--border-primary-color);
  }
}

.card-cover {
  height: 120px;
  background-color: var(--bg-tertiary-color);
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: var(--fg-tertiary-color);
}

.card-content {
  padding: 1rem;
  padding-top: calc(1rem + 30px); // Space for overlapping avatar
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.community-avatar {
  position: absolute;
  top: -30px;
  left: 1rem;
  border: 3px solid var(--bg-secondary-color);
}

.community-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  margin-top: 0.5rem;
}

.community-description {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  margin: 0.5rem 0 1rem;
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card-footer {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--fg-tertiary-color);
  margin-top: auto;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
