<script setup lang="ts">
import type { CommunitiesHubTab } from '../composables/use-communities-hub'
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useAuthStore } from '~/shared/store/auth.store'
import { useCommunitiesHubStore } from '../composables/use-communities-hub'
import CommunityList from './list/community-list.vue'
import CreateCommunityFlow from './new-community/create-community-flow.vue'

const store = useCommunitiesHubStore()
const { activeTab, communities, isLoading } = storeToRefs(store)

const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)

const isCreateModalOpen = ref(false)

const tabItems: ViewSwitcherItem<CommunitiesHubTab>[] = [
  { id: 'my', label: 'Мои сообщества', icon: 'mdi:account-group-outline' },
  { id: 'public', label: 'Найти новые', icon: 'mdi:earth' },
]

onMounted(() => {
  if (!isAuthenticated.value)
    store.activeTab = 'public'

  store.fetchCommunities()
})
</script>

<template>
  <div class="communities-hub">
    <div class="hub-header">
      <div class="header-info">
        <h1>Сообщества</h1>
        <p>Находите единомышленников и делитесь опытом.</p>
      </div>
      <KitBtn icon="mdi:plus" @click="isCreateModalOpen = true">
        Создать
      </KitBtn>
    </div>

    <div v-if="isAuthenticated" class="hub-controls">
      <KitViewSwitcher
        v-model="activeTab"
        :items="tabItems"
        @update:model-value="store.setActiveTab($event)"
      />
    </div>

    <div class="hub-content">
      <CommunityList
        :communities="communities"
        :is-loading="isLoading"
        @retry="store.fetchCommunities(true)"
      />
    </div>

    <CreateCommunityFlow v-model:visible="isCreateModalOpen" />
  </div>
</template>

<style lang="scss" scoped>
.communities-hub {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 4px;
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
  }
}

.hub-controls {
  display: flex;
}
</style>
