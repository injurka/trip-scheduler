<script setup lang="ts">
import type { CustomActivitySection } from '../../models/types.ts'
import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/geolocation-section'
import type {
  ActivitySection,
  ActivitySectionBooking,
  ActivitySectionGallery,
  ActivitySectionMetro,
  ActivitySectionText,
} from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { IconPicker } from '~/components/02.shared/icon-picker'
import { GallerySection } from '~/components/03.domain/trip-info/gallery-section'
import { GeolocationSection } from '~/components/03.domain/trip-info/geolocation-section'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { EActivitySectionType } from '~/shared/types/models/activity'
import BookingSection from './booking-section.vue'
import DescriptionSection from './description-section.vue'
import MetroSection from './metro-section.vue'

interface Props {
  section: ActivitySection
  isFirstAttached: boolean
}
const props = defineProps<Props>()
const emit = defineEmits(['updateSection', 'deleteSection', 'moveSectionUp', 'moveSectionDown'])
const store = useModuleStore(['ui'])
const { isViewMode } = storeToRefs(store.ui)

const defaultColors = [
  'var(--bg-secondary-color)',
  'var(--bg-tertiary-color)',
  '#FFADAD',
  '#FFD6A5',
  '#FDFFB6',
  '#A3D9A5',
  '#9BF6FF',
  '#A0C4FF',
  '#BDB2FF',
  '#FFC6FF',
]

const sectionMetaMap: Record<EActivitySectionType, { label: string, icon: string }> = {
  [EActivitySectionType.DESCRIPTION]: {
    label: 'Заметка',
    icon: 'mdi:text-box-outline',
  },
  [EActivitySectionType.BOOKING]: {
    label: 'Бронирование',
    icon: 'mdi:ticket-confirmation-outline',
  },
  [EActivitySectionType.GALLERY]: {
    label: 'Галерея',
    icon: 'mdi:image-multiple-outline',
  },
  [EActivitySectionType.GEOLOCATION]: {
    label: 'Локация',
    icon: 'mdi:map-marker-outline',
  },
  [EActivitySectionType.METRO]: {
    label: 'Метро',
    icon: 'mdi:subway-variant',
  },
}

const sectionMeta = computed(() => {
  return sectionMetaMap[props.section.type] || {
    label: 'Секция',
    icon: 'mdi:view-grid-outline',
  }
})

const editableTitle = ref((props.section as CustomActivitySection).title || '')
const editableIcon = ref((props.section as CustomActivitySection).icon || 'mdi:map-marker')
const editableColor = ref((props.section as CustomActivitySection).color || defaultColors[0])

function onUpdate(data: ActivitySection) {
  emit('updateSection', data)
}

function toggleAttached() {
  const newSectionData = {
    ...props.section,
    isAttached: !(props.section as CustomActivitySection).isAttached,
  } as CustomActivitySection
  if (!newSectionData.isAttached) {
    delete newSectionData.title
    delete newSectionData.icon
    delete newSectionData.color
  }
  emit('updateSection', newSectionData)
}

function updatePinSettings() {
  if (editableTitle.value !== ((props.section as CustomActivitySection).title || '')
    || editableIcon.value !== ((props.section as CustomActivitySection).icon || 'mdi:map-marker')
    || editableColor.value !== ((props.section as CustomActivitySection).color || defaultColors[0])) {
    emit('updateSection', {
      ...props.section,
      title: editableTitle.value,
      icon: editableIcon.value,
      color: editableColor.value,
    })
  }
}

watch(editableIcon, () => {
  updatePinSettings()
})

watch(editableColor, () => {
  updatePinSettings()
})

watch(() => props.section, (newSection) => {
  const customSection = newSection as CustomActivitySection
  editableTitle.value = customSection.title || ''
  editableIcon.value = customSection.icon || 'mdi:map-marker'
  editableColor.value = customSection.color || defaultColors[0]
}, { deep: true, immediate: true })
</script>

<template>
  <div class="activity-section-renderer" :class="{ 'is-attached': (section as CustomActivitySection).isAttached }">
    <!-- Настройки прикрепленного пина (включая кнопку опций секции) -->
    <div v-if="(section as CustomActivitySection).isAttached && !isViewMode" class="pin-settings">
      <div class="pin-main-settings">
        <KitInput
          v-model="editableTitle"
          placeholder="Заголовок пина"
          class="pin-input"
          size="sm"
          @blur="updatePinSettings"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <IconPicker
          v-model="editableIcon"
          @update:model-value="updatePinSettings"
        />
        <KitTooltip text="Выбрать цвет">
          <KitDropdown :side-offset="8" align="end" class="color-picker-dropdown">
            <template #trigger>
              <button class="color-picker-trigger" type="button">
                <span class="color-preview" :style="{ backgroundColor: editableColor }" />
              </button>
            </template>

            <div class="color-picker-content">
              <div class="color-options">
                <KitTooltip text="Свой цвет">
                  <div class="color-input-wrapper">
                    <input
                      v-model="editableColor"
                      type="color"
                      class="color-input"
                      @input="updatePinSettings"
                    >
                    <Icon icon="mdi:eyedropper-variant" />
                  </div>
                </KitTooltip>
                <button
                  v-for="color in defaultColors"
                  :key="color"
                  type="button"
                  class="color-option"
                  :style="{ backgroundColor: color }"
                  :class="{ 'is-active': editableColor === color }"
                  @click="editableColor = color"
                />
              </div>
            </div>
          </KitDropdown>
        </KitTooltip>

        <KitTooltip text="Опции секции">
          <KitDropdown :side-offset="8" align="end">
            <template #trigger>
              <button class="section-menu-trigger" type="button">
                <Icon icon="mdi:dots-vertical" />
              </button>
            </template>
            <div class="section-menu-content">
              <button class="menu-item" type="button" @click="emit('moveSectionUp')">
                <Icon icon="mdi:arrow-up" />
                <span>Переместить выше</span>
              </button>
              <button class="menu-item" type="button" @click="emit('moveSectionDown')">
                <Icon icon="mdi:arrow-down" />
                <span>Переместить ниже</span>
              </button>
              <button
                class="menu-item"
                type="button"
                :class="{ 'is-active': (section as CustomActivitySection).isAttached }"
                @click="toggleAttached"
              >
                <Icon :icon="(section as CustomActivitySection).isAttached ? 'mdi:link-variant-off' : 'mdi:link-variant-plus'" />
                <span>{{ (section as CustomActivitySection).isAttached ? 'Открепить' : 'Прикрепить к предыдущей' }}</span>
              </button>
              <div class="menu-separator" />
              <button class="menu-item delete" type="button" @click="emit('deleteSection')">
                <Icon icon="mdi:delete-outline" />
                <span>Удалить секцию</span>
              </button>
            </div>
          </KitDropdown>
        </KitTooltip>
      </div>
    </div>

    <!-- Заголовок / панель управления для неприкрепленной секции в режиме редактирования -->
    <div v-else-if="!isViewMode" class="section-header-bar">
      <div class="section-badge">
        <Icon :icon="sectionMeta.icon" class="section-badge-icon" />
        <span class="section-badge-label">{{ sectionMeta.label }}</span>
      </div>

      <div class="section-header-actions">
        <KitTooltip text="Опции секции">
          <KitDropdown :side-offset="4" align="end">
            <template #trigger>
              <button class="section-menu-trigger" type="button">
                <Icon icon="mdi:dots-vertical" />
              </button>
            </template>
            <div class="section-menu-content">
              <button class="menu-item" type="button" @click="emit('moveSectionUp')">
                <Icon icon="mdi:arrow-up" />
                <span>Переместить выше</span>
              </button>
              <button class="menu-item" type="button" @click="emit('moveSectionDown')">
                <Icon icon="mdi:arrow-down" />
                <span>Переместить ниже</span>
              </button>
              <button
                class="menu-item"
                type="button"
                :class="{ 'is-active': (section as CustomActivitySection).isAttached }"
                @click="toggleAttached"
              >
                <Icon :icon="(section as CustomActivitySection).isAttached ? 'mdi:link-variant-off' : 'mdi:link-variant-plus'" />
                <span>{{ (section as CustomActivitySection).isAttached ? 'Открепить' : 'Прикрепить к предыдущей' }}</span>
              </button>
              <div class="menu-separator" />
              <button class="menu-item delete" type="button" @click="emit('deleteSection')">
                <Icon icon="mdi:delete-outline" />
                <span>Удалить секцию</span>
              </button>
            </div>
          </KitDropdown>
        </KitTooltip>
      </div>
    </div>

    <!-- Контент секций -->
    <DescriptionSection
      v-if="section.type === EActivitySectionType.DESCRIPTION"
      :section="section as ActivitySectionText"
      @update-section="onUpdate"
    />
    <GallerySection
      v-else-if="section.type === EActivitySectionType.GALLERY"
      :section="section as ActivitySectionGallery"
      @update-section="onUpdate"
    />
    <GeolocationSection
      v-else-if="section.type === EActivitySectionType.GEOLOCATION"
      :readonly="isViewMode"
      :section="section as ActivitySectionGeolocation"
      @update-section="onUpdate"
    />
    <MetroSection
      v-else-if="section.type === EActivitySectionType.METRO"
      :section="section as ActivitySectionMetro"
      :readonly="isViewMode"
      @update-section="onUpdate"
    />
    <BookingSection
      v-else-if="section.type === EActivitySectionType.BOOKING"
      :section="section as ActivitySectionBooking"
      :readonly="isViewMode"
      @update-section="onUpdate"
      @delete-section="emit('deleteSection')"
    />
  </div>
</template>

<style scoped lang="scss">
.activity-section-renderer {
  position: relative;
  transition: all 0.3s ease;

  &.is-attached {
    padding-left: 8px;
    border-left: 2px dashed var(--border-secondary-color);
  }
}

.section-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 2px 0;
}

.section-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xs);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  user-select: none;

  .section-badge-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }
}

.section-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;

  .section-menu-trigger {
    width: 28px;
    height: 28px;
    font-size: 1.1rem;
  }
}

.pin-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  margin-bottom: 8px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
}

.pin-main-settings {
  display: flex;
  gap: 8px;
  align-items: center;

  .section-menu-trigger {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
}

.pin-input {
  flex-grow: 1;

  :deep(input) {
    height: 40px;
    font-size: 0.9rem;
  }
}

:deep(.icon-picker-wrapper) {
  flex-shrink: 0;
}

.color-picker-dropdown {
  flex-shrink: 0;
}

.color-picker-trigger {
  width: 40px;
  height: 40px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;

  .color-preview {
    width: 100%;
    height: 100%;
    border-radius: var(--r-full);
    border: 1px solid var(--border-primary-color);
    width: 30px;
  }
}

:deep(.kit-dropdown-content) {
  min-width: auto;
  padding: 8px;
}

.color-options {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.color-input-wrapper {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
  cursor: pointer;
  overflow: hidden;

  .iconify {
    position: absolute;
    color: var(--fg-secondary-color);
    pointer-events: none;
  }
}
.color-input {
  width: 100%;
  height: 100%;
  border: none;
  background: none;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding: 0;
  opacity: 0;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  &::-webkit-color-swatch {
    border: none;
  }
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--bg-primary-color);
  outline: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s;
  &.is-active {
    border-color: var(--fg-accent-color);
    transform: scale(1.1);
  }
}

.section-menu-trigger {
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }
}

.section-menu-content {
  display: flex;
  flex-direction: column;
  min-width: 220px;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: var(--r-s);
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  .iconify {
    font-size: 1.2rem;
    color: var(--fg-secondary-color);
  }

  &.is-active {
    color: var(--fg-accent-color);
    .iconify {
      color: var(--fg-accent-color);
    }
  }

  &.delete {
    color: var(--fg-error-color);
    .iconify {
      color: var(--fg-error-color);
    }
    &:hover {
      background-color: rgba(var(--fg-error-color-rgb), 0.1);
    }
  }
}

.menu-separator {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 4px 0;
}
</style>
