<script setup lang="ts">
import type { Community } from '~/shared/types/models/community'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import CommunityCardItem from './community-card-item.vue'
import CommunityListSkeleton from './community-list-skeleton.vue'

interface Props {
  isLoading: boolean
  communities: Community[]
}

defineProps<Props>()
const emit = defineEmits(['retry'])
</script>

<template>
  <AsyncStateWrapper
    :loading="isLoading"
    :data="communities.length > 0 ? communities : null"
    @retry="emit('retry')"
  >
    <template #loading>
      <div class="list-grid">
        <CommunityListSkeleton />
      </div>
    </template>

    <template #success="{ data }">
      <div class="list-grid">
        <CommunityCardItem
          v-for="community in data"
          :key="community.id"
          :community="community"
        />
      </div>
    </template>

    <template #empty>
      <div class="empty-state">
        <p>Сообщества не найдены.</p>
      </div>
    </template>
  </AsyncStateWrapper>
</template>

<style lang="scss" scoped>
.list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 4rem;
  color: var(--fg-secondary-color);
}
</style>
