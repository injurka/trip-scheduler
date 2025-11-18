<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

interface Props {
  currentPage?: number
  totalItems?: number
  itemsPerPage?: number
}

const props = withDefaults(defineProps<Props>(), {
  currentPage: 1,
  totalItems: 0,
  itemsPerPage: 20,
})

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void
}>()

const totalPages = computed(() => Math.ceil(props.totalItems / props.itemsPerPage))

const pages = computed(() => {
  const pagesToShow = []
  const total = totalPages.value
  const current = props.currentPage

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pagesToShow.push(i)
    }
  }
  else {
    pagesToShow.push(1)
    if (current > 4) {
      pagesToShow.push('...')
    }

    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)

    for (let i = start; i <= end; i++) {
      pagesToShow.push(i)
    }

    if (current < total - 3) {
      pagesToShow.push('...')
    }
    pagesToShow.push(total)
  }

  return pagesToShow
})

function goToPage(page: number | string) {
  if (typeof page === 'number' && page >= 1 && page <= totalPages.value) {
    emit('update:currentPage', page)
  }
}

function prevPage() {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
  }
}

function nextPage() {
  if (props.currentPage < totalPages.value) {
    emit('update:currentPage', props.currentPage + 1)
  }
}
</script>

<template>
  <nav v-if="totalPages > 1" class="kit-pagination">
    <button
      class="pagination-btn nav-btn"
      :disabled="currentPage === 1"
      @click="prevPage"
    >
      <Icon icon="mdi:chevron-left" />
    </button>
    <ul class="pages-list">
      <li v-for="(page, index) in pages" :key="index">
        <span v-if="page === '...'" class="ellipsis">...</span>
        <button
          v-else
          class="pagination-btn page-btn"
          :class="{ active: currentPage === page }"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </li>
    </ul>
    <button
      class="pagination-btn nav-btn"
      :disabled="currentPage === totalPages"
      @click="nextPage"
    >
      <Icon icon="mdi:chevron-right" />
    </button>
  </nav>
</template>

<style scoped lang="scss">
.kit-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  user-select: none;
}

.pages-list {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0;
  gap: 4px;
}

.pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.page-btn.active {
  background-color: var(--bg-accent-color);
  color: var(--fg-on-accent-color);
  border-color: var(--bg-accent-color);
  font-weight: 600;
}

.ellipsis {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--fg-tertiary-color);
}
</style>
