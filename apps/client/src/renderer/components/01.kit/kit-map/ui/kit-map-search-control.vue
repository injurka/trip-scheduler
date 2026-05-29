<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { nextTick, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { useToast } from '~/shared/composables/use-toast'
import { useKitMapSearch } from '../composables/use-kit-map-search'

const emit = defineEmits<{
  (e: 'found', coords: { lat: number, lon: number, displayName: string }): void
  (e: 'clear'): void
}>()

const { searchLocation, isSearching } = useKitMapSearch()
const toast = useToast()

const isExpanded = ref(false)
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

async function handleSearch() {
  if (!query.value.trim() || isSearching.value)
    return

  const result = await searchLocation(query.value)
  if (result) {
    emit('found', result)
  }
  else {
    toast.error('Место не найдено')
  }
}

function openSearch() {
  isExpanded.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function closeSearch() {
  isExpanded.value = false
  query.value = ''
  emit('clear')
}

function clearQuery() {
  query.value = ''
  emit('clear')
  inputRef.value?.focus()
}
</script>

<template>
  <div class="kit-map-search-control" :class="{ 'is-expanded': isExpanded }">
    <KitBtn
      v-if="!isExpanded"
      variant="text"
      color="secondary"
      icon="mdi:magnify"
      size="sm"
      class="search-btn"
      title="Поиск места"
      @click="openSearch"
    />

    <form v-else class="search-input-wrapper" @submit.prevent="handleSearch">
      <KitBtn
        variant="text"
        color="secondary"
        icon="mdi:arrow-left"
        size="sm"
        class="search-btn"
        type="button"
        title="Закрыть поиск"
        @click="closeSearch"
      />
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="search-input"
        placeholder="Найти на карте..."
      >

      <div v-if="isSearching" class="search-spinner">
        <Icon icon="mdi:loading" class="spin" />
      </div>

      <template v-else>
        <KitBtn
          v-if="query"
          variant="text"
          color="secondary"
          icon="mdi:close"
          size="sm"
          class="search-btn"
          type="button"
          title="Очистить"
          @click="clearQuery"
        />
        <KitBtn
          variant="text"
          color="secondary"
          icon="mdi:magnify"
          size="sm"
          class="search-btn"
          type="submit"
          title="Найти"
          @click="handleSearch"
        />
      </template>
    </form>
  </div>
</template>

<style scoped lang="scss">
.kit-map-search-control {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  height: 34px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &.is-expanded {
    width: 280px;
  }

  &:not(.is-expanded) {
    width: 34px;
    cursor: pointer;
    &:hover {
      background-color: var(--bg-hover-color);
    }
  }
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  /* Фиксируем ширину (как у открытого контейнера), чтобы элементы не сплющивались во время анимации раскрытия */
  width: 280px;
  height: 100%;
  margin: 0;
  padding: 0;
  /* Добавляем мягкое появление контента */
  animation: fadeIn 0.2s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.search-input {
  flex-grow: 1;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  padding: 0 4px;
  width: 100%;
  min-width: 0;

  &::placeholder {
    color: var(--fg-tertiary-color);
  }
}

:deep(.search-btn) {
  width: 32px;
  height: 32px;
  min-width: 32px;
  /* Запрещаем сжиматься во флексе */
  flex-shrink: 0;
  padding: 0;
  border-radius: 0;
  border: none;
  background-color: transparent;
  color: var(--fg-secondary-color);

  .kit-btn-content {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .iconify {
    font-size: 1.2rem;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.search-spinner {
  width: 32px;
  height: 32px;
  min-width: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);

  .spin {
    animation: spin 1s linear infinite;
    font-size: 1.1rem;
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
