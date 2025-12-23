<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitImage } from '~/components/01.kit/kit-image'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const store = useModuleStore(['memories', 'ui', 'plan'])
const { memories } = storeToRefs(store.memories)

const photoMemories = computed(() =>
  memories.value.filter(m => !!m.imageId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
)

const previewImages = computed(() => photoMemories.value.slice(0, 4))
const totalCount = computed(() => photoMemories.value.length)

function navigateToGallery() {
  store.ui.setActiveView('memories')

  const url = new URL(window.location.href)
  url.searchParams.delete('section')
  window.history.pushState({}, '', url.toString())
}

onMounted(() => {
  if (store.plan.currentTripId) {
    store.memories.fetchMemories(store.plan.currentTripId)
  }
})
</script>

<template>
  <div v-if="totalCount > 0" class="memories-widget-card" @click="navigateToGallery">
    <div class="widget-header">
      <div class="title-wrapper">
        <Icon icon="mdi:image-filter-hdr" class="header-icon" />
        <h3>Галерея</h3>
      </div>
      <div class="count-badge">
        {{ totalCount }} фото
        <Icon icon="mdi:chevron-right" />
      </div>
    </div>

    <div class="preview-strip">
      <div
        v-for="item in previewImages"
        :key="item.id"
        class="preview-item"
      >
        <KitImage
          :src="item.image?.variants?.small || item.image?.url"
          object-fit="cover"
          class="img"
        />
      </div>
      <div v-if="totalCount > 4" class="more-placeholder">
        <span>+{{ totalCount - 4 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-widget-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &:hover {
    border-color: var(--border-primary-color);
    transform: translateY(-2px);
    box-shadow: var(--s-m);
  }
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-primary-color);

  .header-icon {
    font-size: 1.2rem;
    color: var(--fg-accent-color);
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }
}

.count-badge {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-strip {
  display: flex;
  gap: 8px;
  height: 80px;
}

.preview-item {
  flex: 1;
  border-radius: var(--r-s);
  overflow: hidden;
  position: relative;
  background-color: var(--bg-tertiary-color);

  .img {
    width: 100%;
    height: 100%;
  }
}

.more-placeholder {
  flex: 1;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
