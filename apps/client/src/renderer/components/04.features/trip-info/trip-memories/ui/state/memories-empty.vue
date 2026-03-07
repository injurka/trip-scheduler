<script setup lang="ts">
import type { Activity } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { useMediaQuery } from '@vueuse/core'
import { KitBottomSheet } from '~/components/01.kit/kit-bottom-sheet'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'

interface Props {
  isViewMode: boolean
  importOptions?: { value: Activity, label: string, icon?: string }[]
}

withDefaults(defineProps<Props>(), {
  importOptions: () => [],
})

const emit = defineEmits<{
  (e: 'upload'): void
  (e: 'addNote'): void
  (e: 'addActivity'): void
  (e: 'import', activity: Activity): void
}>()

const showImportSheet = ref(false)
const isMobile = useMediaQuery('(max-width: 768px)')

function handleImportSelect(activity: Activity) {
  emit('import', activity)
  showImportSheet.value = false
}
</script>

<template>
  <div class="memories-empty">
    <div class="empty-card">
      <!-- Иконка -->
      <div class="empty-icon-wrap">
        <Icon icon="mdi:camera-iris" class="empty-icon" />
      </div>

      <!-- Текст -->
      <div class="empty-text">
        <p class="empty-title">
          В этом дне пока нет воспоминаний
        </p>
        <p class="empty-subtitle">
          Загрузите фотографии или добавьте заметки, чтобы создать ленту дня.
        </p>
      </div>

      <template v-if="!isViewMode">
        <div class="empty-actions">
          <button class="btn-upload" @click="emit('upload')">
            <Icon icon="mdi:camera-plus-outline" class="btn-icon" />
            <span>Загрузить фото</span>
          </button>

          <div class="btn-secondary-group">
            <button class="btn-secondary" @click="emit('addActivity')">
              <Icon icon="mdi:plus-box-outline" class="btn-icon" />
              <span>Активность</span>
            </button>

            <button class="btn-secondary" @click="emit('addNote')">
              <Icon icon="mdi:note-plus-outline" class="btn-icon" />
              <span>Заметка</span>
            </button>

            <template v-if="isMobile">
              <button
                class="btn-secondary"
                :disabled="importOptions.length === 0"
                @click="showImportSheet = true"
              >
                <Icon icon="mdi:import" class="btn-icon" />
                <span>Из плана</span>
              </button>

              <KitBottomSheet v-model="showImportSheet" title="Импорт из плана">
                <div class="import-sheet-list">
                  <button
                    v-for="item in importOptions"
                    :key="String(item.value)"
                    class="import-sheet-item"
                    @click="handleImportSelect(item.value)"
                  >
                    <span class="import-sheet-item-icon-wrap">
                      <Icon v-if="item.icon" :icon="item.icon" />
                    </span>
                    <span class="import-sheet-item-label">{{ item.label }}</span>
                  </button>
                </div>
              </KitBottomSheet>
            </template>

            <KitDropdown
              v-else
              :items="importOptions"
              align="end"
              @update:model-value="emit('import', $event)"
            >
              <template #trigger>
                <button class="btn-secondary" :disabled="importOptions.length === 0">
                  <Icon icon="mdi:import" class="btn-icon" />
                  <span>Из плана</span>
                </button>
              </template>
            </KitDropdown>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.memories-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0 24px;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px 32px 32px;
  width: 100%;
  max-width: 560px;
  background-color: var(--bg-secondary-color);
  border: 1.5px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  text-align: center;
}

.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--bg-tertiary-color);
}

.empty-icon {
  font-size: 2rem;
  color: var(--fg-secondary-color);
  opacity: 0.6;
}

.empty-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  margin: 0;
  line-height: 1.4;
}

.empty-subtitle {
  font-size: 0.875rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.btn-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 20px;
  background-color: var(--fg-accent-color);
  color: #fff;
  border: none;
  border-radius: var(--r-s);
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    transform 0.1s ease;

  &:hover {
    opacity: 0.88;
  }

  &:active {
    transform: scale(0.99);
  }
}

.btn-secondary-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
}

.btn-secondary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  background-color: var(--bg-primary-color);
  border: 1.5px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg-primary-color);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    border-color: var(--border-primary-color);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.btn-icon {
  font-size: 1.2rem;
  color: var(--fg-secondary-color);

  .btn-upload & {
    color: #fff;
  }
}

.import-sheet-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0 16px;
}

.import-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
  width: 100%;
  border-radius: var(--r-s);

  &:hover,
  &:active {
    background-color: var(--bg-hover-color);
  }

  &-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--r-s);
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  &-label {
    flex-grow: 1;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    line-height: 1.4;
  }
}
</style>
