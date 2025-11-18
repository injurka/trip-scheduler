<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useModuleStore } from '~/components/05.modules/trip-info/composables'
import { TripSectionType } from '~/shared/types/models/trip'
import { useIconPicker } from '../composables/use-icon-picker'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['update:visible', 'addSection'])

const { sections: sectionsStore } = useModuleStore(['sections'])

// --- Состояние для кастомного режима ---
const isCustomMode = ref(false)
const newSectionTitle = ref('')
const newSectionIcon = ref('mdi:note-text-outline')

const { iconSearchQuery, filteredIcons } = useIconPicker()

interface SectionPreset {
  type: TripSectionType
  title: string
  description: string
  icon: string
  isAvailable: boolean
}

const sectionPresets = computed((): SectionPreset[] => {
  const existingTypes = sectionsStore.existingUniqueSectionTypes
  return [
    {
      type: TripSectionType.BOOKINGS,
      title: 'Бронирования',
      description: 'Для хранения информации о билетах, отелях.',
      icon: 'mdi:book-multiple-outline',
      isAvailable: !existingTypes.has(TripSectionType.BOOKINGS),
    },
    {
      type: TripSectionType.CHECKLIST,
      title: 'Чек-лист',
      description: 'Список дел или вещей, которые нужно взять.',
      icon: 'mdi:format-list-checks',
      isAvailable: !existingTypes.has(TripSectionType.CHECKLIST),
    },
    {
      type: TripSectionType.FINANCES,
      title: 'Финансы',
      description: 'Бюджет поездки и учет расходов.',
      icon: 'mdi:cash-multiple',
      isAvailable: !existingTypes.has(TripSectionType.FINANCES),
    },
  ]
})

const availablePresets = computed(() => {
  return sectionPresets.value.filter(p => p.isAvailable)
})

function handleAddSection(payload: TripSectionType | { type: TripSectionType, title: string, icon: string }) {
  emit('addSection', payload)
  isCustomMode.value = false
  newSectionTitle.value = ''
  newSectionIcon.value = 'mdi:file-document-outline'
  iconSearchQuery.value = ''
}

function handleAddCustomSection() {
  if (!newSectionTitle.value.trim())
    return

  handleAddSection({
    type: TripSectionType.NOTES, // Кастомные секции по умолчанию имеют тип "Заметки"
    title: newSectionTitle.value,
    icon: newSectionIcon.value,
  })
}

watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    // Сбрасываем состояние при закрытии окна
    isCustomMode.value = false
    newSectionTitle.value = ''
    newSectionIcon.value = 'mdi:file-document-outline'
    iconSearchQuery.value = ''
  }
  else {
    // Если окно открывается и доступных пресетов нет,
    // сразу переходим в режим создания своего варианта
    if (availablePresets.value.length === 0)
      isCustomMode.value = true
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Добавить новый раздел"
    icon="mdi:plus-box-multiple-outline"
    :max-width="600"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="!isCustomMode" class="presets-grid">
      <!-- Теперь итерация идет по отфильтрованному списку -->
      <template v-for="preset in availablePresets" :key="preset.type">
        <button
          class="preset-card"
          @click="handleAddSection(preset.type)"
        >
          <div class="preset-icon">
            <Icon :icon="preset.icon" />
          </div>
          <div class="preset-info">
            <h3 class="preset-title">
              {{ preset.title }}
            </h3>
            <p class="preset-description">
              {{ preset.description }}
            </p>
          </div>
        </button>
      </template>
      <button class="preset-card custom-card" @click="isCustomMode = true">
        <div class="preset-icon">
          <Icon icon="mdi:pencil-plus-outline" />
        </div>
        <div class="preset-info">
          <h3 class="preset-title">
            Свой вариант
          </h3>
          <p class="preset-description">
            Создать раздел с собственным названием и иконкой.
          </p>
        </div>
      </button>
    </div>
    <form v-else class="add-section-form" @submit.prevent="handleAddCustomSection">
      <!-- Кнопка "Назад" отображается только если были доступны другие пресеты -->
      <KitBtn v-if="availablePresets.length > 0" variant="text" class="back-btn" @click="isCustomMode = false">
        <Icon icon="mdi:arrow-left" /> Назад к пресетам
      </KitBtn>
      <KitInput
        v-model="newSectionTitle"
        label="Название раздела"
        placeholder="Например, 'Билеты' или 'Отели'"
        required
      />
      <div class="icon-picker">
        <label>Иконка</label>
        <KitInput v-model="iconSearchQuery" placeholder="Поиск иконки (напр. 'car')" icon="mdi:magnify" />
        <div class="icon-picker-grid">
          <button
            v-for="icon in filteredIcons"
            :key="icon"
            type="button"
            class="icon-option"
            :class="{ 'is-active': newSectionIcon === icon }"
            @click="newSectionIcon = icon"
          >
            <Icon :icon="icon" />
          </button>
        </div>
      </div>
      <KitBtn type="submit" :disabled="!newSectionTitle.trim()">
        Создать раздел
      </KitBtn>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px 0;
}

.preset-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  gap: 12px;
  padding: 16px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-4px);
    border-color: var(--border-accent-color);
    box-shadow: var(--s-l);
  }
}

.preset-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-accent-color);
  font-size: 1.5rem;
  flex-shrink: 0;
}

.preset-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
}

.preset-description {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.4;
}

.custom-card {
  border-style: dashed;
  .preset-icon {
    background-color: var(--bg-secondary-color);
  }
}

.add-section-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px;
}

.back-btn {
  justify-content: flex-start;
  padding-left: 0;
  color: var(--fg-secondary-color);
  &:hover {
    color: var(--fg-accent-color);
  }
}

.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}
.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 8px;
  max-height: 142px;
  overflow-y: auto;
  background-color: var(--bg-secondary-color);
  padding: 8px;
  border-radius: var(--r-s);

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  border: 1px solid transparent;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.4rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
  &.is-active {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}
</style>
