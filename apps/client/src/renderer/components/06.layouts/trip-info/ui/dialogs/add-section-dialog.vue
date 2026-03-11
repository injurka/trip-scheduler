<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { useModuleStore } from '~/components/05.modules/trip-info/composables'
import { TripSectionType } from '~/shared/types/models/trip'

defineProps<{ visible: boolean }>()
const emit = defineEmits(['update:visible', 'addSection'])

const { sections: sectionsStore } = useModuleStore(['sections'])

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
    {
      type: TripSectionType.MEMORIES,
      title: 'Галерея воспоминаний',
      description: 'Все фотографии со всех дней в одном месте.',
      icon: 'mdi:image-filter-hdr',
      isAvailable: !existingTypes.has(TripSectionType.MEMORIES),
    },
    {
      type: TripSectionType.NOTES,
      title: 'Заметки',
      description: 'Файлы и папки с markdown-заметками и скетчами.',
      icon: 'mdi:note-edit-outline',
      isAvailable: !existingTypes.has(TripSectionType.NOTES),
    },
    {
      type: TripSectionType.DOCUMENTS,
      title: 'Документы',
      description: 'Хранение важных файлов: билеты, страховки.',
      icon: 'mdi:file-document-multiple-outline',
      isAvailable: !existingTypes.has(TripSectionType.DOCUMENTS),
    },
  ]
})

const availablePresets = computed(() => {
  return sectionPresets.value.filter(p => p.isAvailable)
})

function handleAddSection(payload: TripSectionType | { type: TripSectionType, title: string, icon: string }) {
  emit('addSection', payload)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Добавить новый раздел"
    icon="mdi:plus-box-multiple-outline"
    :max-width="600"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="presets-grid">
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
    </div>
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
</style>
