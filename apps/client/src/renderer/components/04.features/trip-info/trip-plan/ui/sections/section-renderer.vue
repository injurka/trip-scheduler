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
        <div class="icon-picker-wrapper">
          <IconPicker
            v-model="editableIcon"
            size="sm"
            @update:model-value="updatePinSettings"
          />
        </div>
        <KitDropdown :side-offset="8" align="end" class="color-picker-dropdown">
          <template #trigger>
            <button class="color-picker-trigger" type="button" title="Выбрать цвет">
              <span class="color-preview" :style="{ backgroundColor: editableColor }" />
            </button>
          </template>

          <div class="color-picker-content">
            <div class="color-options">
              <div class="color-input-wrapper" title="Свой цвет">
                <input
                  v-model="editableColor"
                  type="color"
                  class="color-input"
                  @input="updatePinSettings"
                >
                <Icon icon="mdi:eyedropper-variant" />
              </div>
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
      <div class="section-controls">
        <div class="controls-group">
          <button
            class="control-btn"
            title="Переместить выше"
            @click="emit('moveSectionUp')"
          >
            <Icon icon="mdi:arrow-up" />
          </button>
          <button
            class="control-btn"
            title="Переместить ниже"
            @click="emit('moveSectionDown')"
          >
            <Icon icon="mdi:arrow-down" />
          </button>
        </div>

        <div class="separator" />

        <button
          class="control-btn attach-btn"
          :class="{ 'is-active': (section as CustomActivitySection).isAttached }"
          :title="(section as CustomActivitySection).isAttached ? 'Открепить секцию' : 'Прикрепить к предыдущей'"
          @click="toggleAttached"
        >
          <Icon :icon="(section as CustomActivitySection).isAttached ? 'mdi:link-variant-off' : 'mdi:link-variant-plus'" />
        </button>

        <div class="separator" />

        <button
          class="control-btn delete-btn"
          title="Удалить секцию"
          @click="emit('deleteSection')"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>
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
    height: 38px;
    font-size: 0.9rem;
  }
}

.icon-picker-wrapper {
  flex-shrink: 0;
}

.color-picker-dropdown {
  flex-shrink: 0;
}

.color-picker-trigger {
  width: 38px;
  height: 38px;
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
    border-radius: var(--r-2xs);
    border: 1px solid var(--border-primary-color);
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
  top: -20px;
  right: 4px;
  z-index: 10;

  opacity: 0;
  transform: translateY(-4px) scale(0.95);
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.activity-section-renderer:hover .section-controls-wrapper {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.section-controls {
  display: flex;
  align-items: center;
  background-color: rgba(var(--bg-primary-color-rgb), 0.95);
  backdrop-filter: blur(8px);
  padding: 2px;
  border-radius: var(--r-full);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-m);
  gap: 4px;
}

.controls-group {
  display: flex;
  gap: 2px;
}

.separator {
  width: 1px;
  height: 16px;
  background-color: var(--border-secondary-color);
  margin: 0 2px;
}

.control-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: transparent;
  border: 1px solid transparent;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.attach-btn {
    &.is-active {
      color: var(--fg-accent-color);
      background-color: rgba(var(--fg-accent-color-rgb), 0.1);
    }
    &:hover {
      color: var(--fg-accent-color);
    }
  }

  &.delete-btn {
    &:hover {
      background-color: var(--bg-error-color);
      color: var(--fg-error-color);
      border-color: var(--border-error-color); /* При наведении красная обводка */
      color: white;
    }
  }
}

@include media-down(md) {
  .section-controls-wrapper {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
    right: 0px;
  }

  .activity-section-renderer:active .section-controls-wrapper,
  .activity-section-renderer:focus-within .section-controls-wrapper {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
