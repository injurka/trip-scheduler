<script setup lang="ts">
import type { TripNote } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'

const props = defineProps<{
  visible: boolean
  files: TripNote[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'select': [id: string]
}>()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    searchQuery.value = ''
    selectedIndex.value = 0
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

const filteredFiles = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q)
    return props.files
  return props.files.filter(f => f.title.toLowerCase().includes(q))
})

watch(filteredFiles, () => {
  selectedIndex.value = 0
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < filteredFiles.value.length - 1) {
      selectedIndex.value++
    }
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    selectCurrent()
  }
}

function selectCurrent() {
  const file = filteredFiles.value[selectedIndex.value]
  if (file) {
    emit('select', file.id)
    emit('update:visible', false)
  }
}

function selectFile(id: string) {
  emit('select', id)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Быстрый переход"
    :max-width="500"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="command-palette">
      <div class="search-box">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Поиск по файлам..."
          @keydown="handleKeydown"
        >
      </div>

      <div class="results-list">
        <div v-if="filteredFiles.length === 0" class="no-results">
          Файлы не найдены
        </div>
        <button
          v-for="(file, index) in filteredFiles"
          :key="file.id"
          class="result-item"
          :class="{ 'is-selected': index === selectedIndex }"
          @click="selectFile(file.id)"
          @mouseenter="selectedIndex = index"
        >
          <Icon
            :icon="file.type === 'excalidraw' ? 'mdi:draw' : 'mdi:file-document-outline'"
            class="file-icon"
            :class="file.type"
          />
          <span class="file-title">{{ file.title }}</span>
        </button>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.command-palette {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px 12px;

  .search-icon {
    font-size: 1.2rem;
    color: var(--fg-tertiary-color);
  }

  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--fg-primary-color);
    font-size: 1rem;

    &::placeholder {
      color: var(--fg-tertiary-color);
    }
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  max-height: 300px;
  overflow-y: auto;
  gap: 2px;
  margin: 0 -8px;
  padding: 0 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: var(--r-s);
  cursor: pointer;
  text-align: left;
  color: var(--fg-primary-color);

  &.is-selected {
    background: var(--bg-hover-color);
  }

  .file-icon {
    width: 16px;
    height: 16px;
    color: var(--fg-secondary-color);
  }

  .file-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.no-results {
  padding: 24px 12px;
  text-align: center;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
}
</style>
