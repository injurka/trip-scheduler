<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { useAuthStore } from '~/shared/store/auth.store'
import { useHighlights } from '../composables/use-highlights'

const authStore = useAuthStore()
const {
  userId,
  highlights,
  countries,
  isLoading,
  isCreateModalOpen,
  isUploading,
  isSubmitting,
  areCountriesLoading,
  form,
  fetchHighlights,
  openCreateModal,
  handleFileSelect,
  submitHighlight,
  deleteHighlight,
} = useHighlights()

const fileInput = ref<HTMLInputElement | null>(null)

const isOwner = computed(() => {
  return authStore.user?.id === userId.value
})

const countryOptions = computed(() => {
  return countries.value.map(c => ({
    value: c.id,
    label: c.name,
    flagUrl: c.emoji, // Используем поле эмодзи для флага
  }))
})

onMounted(() => {
  fetchHighlights()
})
</script>

<template>
  <div class="highlights-feed">
    <!-- Тулбар -->
    <div class="toolbar">
      <div class="toolbar-content">
        <!-- Слева: Фильтры -->
        <div class="toolbar-left">
          <div class="filter-section">
            <Icon icon="mdi:filter-variant" />
            <span class="desktop-text">Фильтры</span>
          </div>
          <div class="quality-section">
            <Icon icon="mdi:star-outline" />
            <span class="desktop-text">Качество</span>
          </div>
        </div>

        <!-- Справа: Кнопка "Создать" (только для владельца) -->
        <div v-if="isOwner" class="toolbar-right">
          <KitBtn size="sm" :loading="areCountriesLoading" @click="openCreateModal">
            <Icon icon="mdi:plus" />
            <span>Создать</span>
          </KitBtn>
        </div>
      </div>
    </div>

    <!-- Список фото -->
    <AsyncStateWrapper :loading="isLoading" :data="highlights.length > 0 ? highlights : null">
      <template #success="{ data }">
        <div class="highlights-grid">
          <div v-for="item in data" :key="item.id" class="highlight-card">
            <KitImage :src="item.imageUrl" alt="Highlight" class="highlight-image" />
            <div class="highlight-overlay">
              <div class="highlight-info">
                <h4>
                  <span v-if="item.country?.emoji">{{ item.country.emoji }}</span>
                  {{ item.city }}, {{ item.country?.name || 'Неизвестно' }}
                </h4>
                <p v-if="item.address" class="address">
                  <Icon icon="mdi:map-marker" /> {{ item.address }}
                </p>
                <p v-if="item.comment" class="comment">
                  {{ item.comment }}
                </p>
              </div>
              <button v-if="isOwner" class="delete-btn" @click.stop="deleteHighlight(item.id)">
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </div>
          </div>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <Icon icon="mdi:image-off-outline" />
          <p>В витрине пока нет фото.</p>
        </div>
      </template>
    </AsyncStateWrapper>

    <!-- Модальное окно создания -->
    <div v-if="isCreateModalOpen" class="custom-modal-overlay" @click.self="isCreateModalOpen = false">
      <div class="custom-modal-content">
        <header class="modal-header">
          <h3>Добавить фото в витрину</h3>
          <button class="close-btn" @click="isCreateModalOpen = false">
            <Icon icon="mdi:close" />
          </button>
        </header>

        <div class="modal-body">
          <div class="upload-area" :class="{ 'has-image': form.imageUrl }">
            <template v-if="form.imageUrl">
              <img :src="form.imageUrl" alt="Preview">
              <KitBtn variant="subtle" size="sm" class="change-photo-btn" @click="fileInput?.click()">
                Изменить фото
              </KitBtn>
            </template>
            <template v-else>
              <KitBtn :loading="isUploading" variant="outlined" @click="fileInput?.click()">
                <Icon icon="mdi:upload" /> Загрузить фото
              </KitBtn>
            </template>
            <input ref="fileInput" type="file" hidden accept="image/*" @change="handleFileSelect">
          </div>

          <div v-if="form.imageUrl" class="form-fields">
            <div class="row">
              <KitSelectWithSearch
                v-model="form.countryId"
                :items="countryOptions"
                label="Страна *"
                placeholder="Выберите страну"
              >
                <template #item="{ item }">
                  <span class="dropdown-flag">{{ (item as any).flagUrl }}</span>
                  <span>{{ item.label }}</span>
                </template>
              </KitSelectWithSearch>

              <KitInput v-model="form.city" label="Город *" placeholder="Например, Рим" />
            </div>

            <KitInput v-model="form.address" label="Адрес (Опционально)" placeholder="Улица, место..." />

            <div class="row geo-row">
              <KitInput v-model="form.latitude" type="number" label="Широта (EXIF)" placeholder="0.0000" />
              <KitInput v-model="form.longitude" type="number" label="Долгота (EXIF)" placeholder="0.0000" />
            </div>

            <KitInput v-model="form.comment" label="Комментарий" placeholder="Пара слов об этом месте..." />
          </div>
        </div>

        <footer class="modal-footer">
          <KitBtn variant="outlined" color="secondary" @click="isCreateModalOpen = false">
            Отмена
          </KitBtn>
          <KitBtn :disabled="!form.imageUrl || !form.countryId || !form.city" :loading="isSubmitting" @click="submitHighlight">
            Сохранить
          </KitBtn>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.highlights-feed {
  width: 100%;
}

.toolbar {
  margin-bottom: 24px;
}

.toolbar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.toolbar-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-section,
.quality-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--fg-primary-color);
  font-weight: 500;
  font-size: 0.9rem;

  &:hover {
    background-color: var(--bg-tertiary-color);
  }

  .iconify {
    font-size: 1.2rem;
  }

  .desktop-text {
    display: inline;
  }

  @include media-down(md) {
    padding: 10px;

    .desktop-text {
      display: none;
    }
  }
}

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.highlight-card {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  aspect-ratio: 4/5;
  background: var(--bg-secondary-color);
  cursor: pointer;

  .highlight-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .highlight-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 20px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    opacity: 0.9;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }

  h4 {
    margin: 0 0 4px;
    font-size: 1.1rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .address {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }

  .delete-btn {
    background: rgba(255, 0, 0, 0.6);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: red;
    }
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--fg-secondary-color);

  .iconify {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
}

/* Стили кастомного модального окна */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.custom-modal-content {
  background: var(--bg-primary-color);
  width: 100%;
  max-width: 500px;
  border-radius: var(--r-l);
  box-shadow: var(--s-l);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--fg-secondary-color);
    cursor: pointer;
    font-size: 1.5rem;
  }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-area {
  width: 100%;
  min-height: 150px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  &.has-image {
    border-style: solid;
  }

  img {
    width: 100%;
    height: 250px;
    object-fit: cover;
  }

  .change-photo-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
  }
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: flex;
  gap: 16px;
  > * {
    flex: 1;
  }

  @include media-down(sm) {
    flex-direction: column;
  }
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dropdown-flag {
  font-size: 1.2rem;
  margin-right: 8px;
}
</style>
