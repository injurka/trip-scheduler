<script setup lang="ts">
import type { CustomActivitySection } from '../../models/types.ts'
import type { ActivitySectionGeolocation } from '~/components/03.domain/trip-info/geolocation-section'
import type {
  ActivitySection,
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
    || editableColor.value !== ((props.section as CustomActivitySection).color || defaultColors[0])) { emit('updateSection', { ...props.section, title: editableTitle.value, icon: editableIcon.value, color: editableColor.value }) }
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
        <KitDropdown :side-offset="8" align="end" class="color-picker-dropdown">
          <template #trigger>
            <KitTooltip text="Выбрать цвет">
              <button class="color-picker-trigger" type="button">
                <span class="color-preview" :style="{ backgroundColor: editableColor }" />
              </button>
            </KitTooltip>
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
                class="color-option"
                :style="{ backgroundColor: color }"
                :class="{ 'is-active': editableColor === color }"
                @click="editableColor = color"
              />
            </div>
          </div>
        </KitDropdown>
      </div>
    </div>

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

    <div v-if="!isViewMode" class="section-controls-wrapper">
      <KitDropdown :side-offset="4" align="end">
        <template #trigger>
          <KitTooltip text="Опции секции">
            <button class="section-menu-trigger">
              <Icon icon="mdi:dots-vertical" />
            </button>
          </KitTooltip>
        </template>
        <div class="section-menu-content">
          <button class="menu-item" @click="emit('moveSectionUp')">
            <Icon icon="mdi:arrow-up" />
            <span>Переместить выше</span>
          </button>
          <button class="menu-item" @click="emit('moveSectionDown')">
            <Icon icon="mdi:arrow-down" />
            <span>Переместить ниже</span>
          </button>
          <button
            class="menu-item"
            :class="{ 'is-active': (section as CustomActivitySection).isAttached }"
            @click="toggleAttached"
          >
            <Icon :icon="(section as CustomActivitySection).isAttached ? 'mdi:link-variant-off' : 'mdi:link-variant-plus'" />
            <span>{{ (section as CustomActivitySection).isAttached ? 'Открепить' : 'Прикрепить к предыдущей' }}</span>
          </button>
          <div class="menu-separator" />
          <button class="menu-item delete" @click="emit('deleteSection')">
            <Icon icon="mdi:delete-outline" />
            <span>Удалить секцию</span>
          </button>
        </div>
      </KitDropdown>
    </div>
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

  &:hover {
    z-index: 5;
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

.section-controls-wrapper {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.activity-section-renderer:hover .section-controls-wrapper,
.activity-section-renderer:focus-within .section-controls-wrapper {
  opacity: 1;
}

.section-menu-trigger {
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  background-color: rgba(var(--bg-primary-color-rgb), 0.8);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  box-shadow: var(--s-s);

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
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

@include media-down(md) {
  .section-controls-wrapper {
    opacity: 1;
    right: 4px;
    top: 4px;
  }
}
</style>
