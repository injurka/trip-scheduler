<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { EActivitySectionType } from '~/shared/types/models/activity'

interface SectionOption {
  type: EActivitySectionType
  label: string
  icon: string
  shortcut?: string
  description: string
  category: 'content' | 'media' | 'location'
}

const emit = defineEmits<{
  addSection: [type: EActivitySectionType]
}>()

const isOpen = ref(false)

const sectionOptions: SectionOption[] = [
  {
    type: EActivitySectionType.DESCRIPTION,
    label: 'Заметка',
    icon: 'mdi:text-box-plus-outline',
    shortcut: 'T',
    description: 'Добавить текстовую заметку или описание',
    category: 'content',
  },
  {
    type: EActivitySectionType.GALLERY,
    label: 'Галерея',
    icon: 'mdi:image-multiple-outline',
    shortcut: 'G',
    description: 'Добавить фотографии или изображения',
    category: 'media',
  },
  {
    type: EActivitySectionType.GEOLOCATION,
    label: 'Локация',
    icon: 'mdi:map-marker-plus-outline',
    shortcut: 'L',
    description: 'Добавить местоположение на карте',
    category: 'location',
  },
  {
    type: EActivitySectionType.METRO,
    label: 'Метро',
    icon: 'mdi:subway-variant',
    shortcut: 'M',
    description: 'Добавить маршрут на метро',
    category: 'location',
  },
]

const contentOptions = computed(() => sectionOptions.filter(opt => opt.category === 'content'))
const mediaOptions = computed(() => sectionOptions.filter(opt => opt.category === 'media'))
const locationOptions = computed(() => sectionOptions.filter(opt => opt.category === 'location'))

function handleAddSection(type: EActivitySectionType) {
  emit('addSection', type)
  isOpen.value = false
}

useEventListener('keydown', (e) => {
  if (!isOpen.value)
    return

  const option = sectionOptions.find(opt =>
    opt.shortcut?.toLowerCase() === e.key.toLowerCase(),
  )

  if (option) {
    e.preventDefault()
    handleAddSection(option.type)
  }

  if (e.key === 'Escape') {
    isOpen.value = false
  }
})
</script>

<template>
  <DropdownMenuRoot v-model:open="isOpen">
    <DropdownMenuTrigger as-child>
      <button
        class="add-section-trigger"
        :class="{ 'is-open': isOpen }"
      >
        <Icon icon="mdi:plus" class="plus-icon" />
        <span class="trigger-text">Добавить блок</span>
        <Icon icon="mdi:chevron-down" class="chevron-icon" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent class="add-section-dropdown" align="start" :side-offset="8">
        <!-- Заголовок -->
        <div class="dropdown-header">
          <Icon icon="mdi:plus-box-multiple" class="header-icon" />
          <div class="header-text">
            <div class="header-title">
              Добавить блок
            </div>
            <div class="header-subtitle">
              Выберите тип содержимого
            </div>
          </div>
        </div>

        <DropdownMenuSeparator class="dropdown-separator" />

        <!-- Контентные блоки -->
        <div class="section-category">
          <div class="category-label">
            <Icon icon="mdi:text" class="category-icon" />
            <span>Контент</span>
          </div>
          <DropdownMenuItem
            v-for="option in contentOptions"
            :key="option.type"
            class="section-option"
            @click="handleAddSection(option.type)"
          >
            <div class="option-icon">
              <Icon :icon="option.icon" />
            </div>
            <div class="option-content">
              <div class="option-label">
                {{ option.label }}
              </div>
              <div class="option-description">
                {{ option.description }}
              </div>
            </div>
            <div v-if="option.shortcut" class="option-shortcut">
              {{ option.shortcut }}
            </div>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator class="dropdown-separator" />

        <!-- Медиа блоки -->
        <div class="section-category">
          <div class="category-label">
            <Icon icon="mdi:image" class="category-icon" />
            <span>Медиа</span>
          </div>
          <DropdownMenuItem
            v-for="option in mediaOptions"
            :key="option.type"
            class="section-option"
            @click="handleAddSection(option.type)"
          >
            <div class="option-icon">
              <Icon :icon="option.icon" />
            </div>
            <div class="option-content">
              <div class="option-label">
                {{ option.label }}
              </div>
              <div class="option-description">
                {{ option.description }}
              </div>
            </div>
            <div v-if="option.shortcut" class="option-shortcut">
              {{ option.shortcut }}
            </div>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator class="dropdown-separator" />

        <!-- Локация -->
        <div class="section-category">
          <div class="category-label">
            <Icon icon="mdi:map" class="category-icon" />
            <span>Местоположение</span>
          </div>
          <DropdownMenuItem
            v-for="option in locationOptions"
            :key="option.type"
            class="section-option"
            @click="handleAddSection(option.type)"
          >
            <div class="option-icon">
              <Icon :icon="option.icon" />
            </div>
            <div class="option-content">
              <div class="option-label">
                {{ option.label }}
              </div>
              <div class="option-description">
                {{ option.description }}
              </div>
            </div>
            <div v-if="option.shortcut" class="option-shortcut">
              {{ option.shortcut }}
            </div>
          </DropdownMenuItem>
        </div>

        <!-- Подсказка по горячим клавишам -->
        <DropdownMenuSeparator class="dropdown-separator" />
        <div class="keyboard-hint">
          <Icon icon="mdi:keyboard" class="hint-icon" />
          <span>Используйте горячие клавиши для быстрого добавления</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped lang="scss">
.add-section-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: fit-content;
  min-width: 160px;
  position: relative;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }

  &.is-open {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background: var(--bg-hover-color);
    border-style: solid;
  }

  .plus-icon {
    font-size: 1.1rem;
    transition: transform 0.2s ease;
  }

  &.is-open .plus-icon {
    transform: rotate(45deg);
  }

  .trigger-text {
    flex: 1;
  }

  .chevron-icon {
    font-size: 1rem;
    transition: transform 0.2s ease;
    opacity: 0.7;
  }

  &.is-open .chevron-icon {
    transform: rotate(180deg);
  }
}

:deep(.add-section-dropdown) {
  min-width: 320px;
  max-width: 400px;
  padding: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-l);
  z-index: 50;

  &[data-side='top'] {
    animation: slideDownAndFade 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  &[data-side='right'] {
    animation: slideLeftAndFade 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  &[data-side='bottom'] {
    animation: slideUpAndFade 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  &[data-side='left'] {
    animation: slideRightAndFade 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.dropdown-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  margin-bottom: 4px;

  .header-icon {
    font-size: 20px;
    color: var(--fg-accent-color);
    margin-top: 2px;
    flex-shrink: 0;
  }

  .header-text {
    flex: 1;
  }

  .header-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.4;
  }

  .header-subtitle {
    font-size: 12px;
    color: var(--fg-muted-color);
    margin-top: 2px;
  }
}

.section-category {
  margin: 8px 0;

  .category-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;

    .category-icon {
      font-size: 12px;
    }
  }
}

.section-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  outline: none;

  &[data-highlighted] {
    background: var(--bg-hover-color);
  }

  &:active {
    transform: scale(0.98);
  }

  .option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-s);
    background: var(--bg-secondary-color);
    color: var(--fg-accent-color);
    flex-shrink: 0;
    transition: all 0.2s ease;

    .iconify {
      font-size: 16px;
    }
  }

  &[data-highlighted] .option-icon {
    background: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    transform: scale(1.05);
  }

  .option-content {
    flex: 1;
    min-width: 0;

    .option-label {
      font-weight: 600;
      color: var(--fg-primary-color);
      margin-bottom: 2px;
      font-size: 14px;
    }

    .option-description {
      font-size: 12px;
      color: var(--fg-secondary-color);
      line-height: 1.3;
    }
  }

  .option-shortcut {
    padding: 4px 8px;
    background: var(--bg-secondary-color);
    border-radius: var(--r-2xs);
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-secondary-color);
    min-width: 24px;
    text-align: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  &[data-highlighted] .option-shortcut {
    background: var(--fg-accent-color);
    color: var(--fg-inverted-color);
  }
}

.keyboard-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  font-size: 11px;
  color: var(--fg-muted-color);
  margin-top: 4px;

  .hint-icon {
    font-size: 12px;
  }
}

.dropdown-separator {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 8px -12px;
}

@keyframes slideUpAndFade {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slideRightAndFade {
  from {
    opacity: 0;
    transform: translateX(-4px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes slideDownAndFade {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slideLeftAndFade {
  from {
    opacity: 0;
    transform: translateX(4px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}
</style>
