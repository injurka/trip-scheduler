<script setup lang="ts">
import type { DayMetaBadgePreset } from '../lib/badge-presets'
import type { Booking, BookingSectionContent } from '~/components/04.features/trip-info/trip-sections'
import type { DayMetaInfo } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { v4 as uuidv4 } from 'uuid'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { DayBookingsModal } from '~/components/04.features/trip-info/trip-sections'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { TripSectionType } from '~/shared/types/models/trip'
import { badgePresets } from '../lib/badge-presets'

interface Props {
  meta: DayMetaInfo[]
  readonly?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:meta'])

const confirm = useConfirm()
const store = useModuleStore(['plan', 'sections'])
const { getSelectedDay } = storeToRefs(store.plan)

// --- State ---
const isEditorOpen = ref(false)
const isViewerOpen = ref(false)
const currentItem = ref<DayMetaInfo | null>(null)
const iconSearchQuery = ref('')
const isAddMenuOpen = ref(false)
const isBookingsModalOpen = ref(false)

// --- Constants ---
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

const currentItemContent = computed({
  get: () => currentItem.value?.content ?? '',
  set: (value) => {
    if (currentItem.value)
      currentItem.value.content = value
  },
})

const filteredIcons = computed(() => {
  if (!iconSearchQuery.value)
    return sharedIconList

  return sharedIconList.filter(icon => icon.toLowerCase().includes(iconSearchQuery.value.toLowerCase()))
})

const groupedPresets = computed(() => {
  return badgePresets.reduce((acc, preset) => {
    const category = preset.templateCategory || 'Прочее'
    if (!acc[category])
      acc[category] = []
    acc[category].push(preset)
    return acc
  }, {} as Record<string, DayMetaBadgePreset[]>)
})

const bookingsForSelectedDay = computed(() => {
  if (!getSelectedDay.value)
    return []

  const bookingSection = store.sections.sections.find(s => s.type === TripSectionType.BOOKINGS)
  if (!bookingSection)
    return []

  const content = bookingSection.content as BookingSectionContent
  if (!content || !Array.isArray(content.bookings))
    return []

  const selectedDateStr = getSelectedDay.value.date.split('T')[0]
  const selectedDate = new Date(selectedDateStr)

  return content.bookings.filter((booking: Booking) => {
    switch (booking.type) {
      case 'hotel': {
        if (!booking.data.checkInDate || !booking.data.checkOutDate)
          return false
        const checkIn = new Date(booking.data.checkInDate.split('T')[0])
        const checkOut = new Date(booking.data.checkOutDate.split('T')[0])
        return selectedDate >= checkIn && selectedDate < checkOut
      }
      case 'flight': {
        return booking.data.segments?.some(segment =>
          segment.departureDateTime && segment.departureDateTime.startsWith(selectedDateStr),
        )
      }
      case 'train': {
        return booking.data.departureDateTime?.startsWith(selectedDateStr)
      }
      case 'attraction': {
        return booking.data.dateTime?.startsWith(selectedDateStr)
      }
      default:
        return false
    }
  })
})

function getContrastColor(hexcolor: string | undefined): string {
  if (!hexcolor)
    return '#000000'

  if (hexcolor.startsWith('var(')) {
    return 'var(--fg-primary-color)'
  }

  hexcolor = hexcolor.replace('#', '')
  const r = Number.parseInt(hexcolor.substring(0, 2), 16)
  const g = Number.parseInt(hexcolor.substring(2, 4), 16)
  const b = Number.parseInt(hexcolor.substring(4, 6), 16)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000

  return (yiq >= 128) ? '#000000' : '#FFFFFF'
}

function openEditor(item?: DayMetaInfo) {
  currentItem.value = { ...(item || { id: uuidv4(), title: '', subtitle: '', color: defaultColors[0], icon: 'mdi:information-outline', content: '' }) }
  isEditorOpen.value = true
}

function openViewer(item: DayMetaInfo) {
  if (!item.content)
    return
  currentItem.value = item
  isViewerOpen.value = true
}

function handleSave() {
  if (!currentItem.value || !currentItem.value.title)
    return

  const existingItemIndex = props.meta.findIndex(m => m.id === currentItem.value!.id)
  let newMeta: DayMetaInfo[]

  if (existingItemIndex > -1) {
    newMeta = props.meta.map(m => (m.id === currentItem.value!.id ? currentItem.value! : m))
  }
  else {
    newMeta = [...props.meta, currentItem.value]
  }

  emit('update:meta', newMeta)
  closeEditor()
}

async function handleDelete(item: DayMetaInfo) {
  const isConfirmed = await confirm({
    title: `Удалить "${item.title}"?`,
    description: 'Это действие нельзя будет отменить.',
  })
  if (isConfirmed) {
    const newMeta = props.meta.filter(m => m.id !== item.id)
    emit('update:meta', newMeta)
  }
}

function closeEditor() {
  isEditorOpen.value = false
  currentItem.value = null
}

function closeViewer() {
  isViewerOpen.value = false
  currentItem.value = null
}

function applyPreset(preset: DayMetaBadgePreset) {
  const newItem: DayMetaInfo = {
    id: uuidv4(),
    title: preset.title || '',
    subtitle: preset.subtitle || '',
    icon: preset.icon || 'mdi:information-outline',
    color: preset.color || defaultColors[0],
    content: preset.content || '',
  }
  openEditor(newItem)
}

function createBlankBadge() {
  openEditor()
}
</script>

<template>
  <div class="day-meta-badges-container">
    <div class="badges-wrapper">
      <!-- Новый бейдж для бронирований -->
      <div v-if="bookingsForSelectedDay.length > 0" class="badge-wrapper">
        <button
          class="badge booking-badge"
          @click="isBookingsModalOpen = true"
        >
          <Icon icon="mdi:ticket-confirmation-outline" class="badge-icon" />
          <div class="badge-text">
            <span class="badge-title">Бронирования</span>
            <span class="badge-subtitle">({{ bookingsForSelectedDay.length }})</span>
          </div>
        </button>
      </div>

      <TooltipProvider :delay-duration="200">
        <template v-for="item in meta" :key="item.id">
          <TooltipRoot v-if="item.content">
            <TooltipTrigger as-child>
              <div class="badge-wrapper">
                <button
                  class="badge"
                  :style="{
                    backgroundColor: `${item.color}70`,
                    color: getContrastColor(item.color),
                    borderColor: `${item.color}50`,
                  }"
                  @click="openViewer(item)"
                >
                  <Icon v-if="item.icon" :icon="item.icon" class="badge-icon" />
                  <div class="badge-text">
                    <span class="badge-title">{{ item.title }}</span>
                    <span v-if="item.subtitle" class="badge-subtitle">{{ item.subtitle }}</span>
                  </div>
                </button>
                <div v-if="!readonly" class="badge-actions">
                  <button class="action-btn edit" title="Редактировать" @click="openEditor(item)">
                    <Icon icon="mdi:pencil-outline" />
                  </button>
                  <button class="action-btn delete" title="Удалить" @click="handleDelete(item)">
                    <Icon icon="mdi:trash-can-outline" />
                  </button>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                class="badge-tooltip-content"
                :side-offset="8"
                side="top"
              >
                <KitInlineMdEditorWrapper :model-value="item.content || ''" :readonly="true" />
                <TooltipArrow class="badge-tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
          <div v-else class="badge-wrapper">
            <button
              class="badge"
              :style="{
                backgroundColor: `${item.color}70`,
                color: getContrastColor(item.color),
                borderColor: `${item.color}50`,
              }"
            >
              <Icon v-if="item.icon" :icon="item.icon" class="badge-icon" />
              <div class="badge-text">
                <span class="badge-title">{{ item.title }}</span>
                <span v-if="item.subtitle" class="badge-subtitle">{{ item.subtitle }}</span>
              </div>
            </button>
            <div v-if="!readonly" class="badge-actions">
              <button class="action-btn edit" title="Редактировать" @click="openEditor(item)">
                <Icon icon="mdi:pencil-outline" />
              </button>
              <button class="action-btn delete" title="Удалить" @click="handleDelete(item)">
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </div>
          </div>
        </template>
      </TooltipProvider>
    </div>

    <DropdownMenuRoot v-if="!readonly" v-model:open="isAddMenuOpen">
      <DropdownMenuTrigger as-child>
        <KitBtn
          variant="outlined"
          icon="mdi:plus-circle-outline"
          class="add-badge-btn"
        >
          Добавить инфо
        </KitBtn>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="add-badge-dropdown" :side-offset="8" align="start">
          <DropdownMenuItem class="preset-item" @click="createBlankBadge">
            <div class="preset-icon-wrapper">
              <Icon icon="mdi:pencil-plus-outline" />
            </div>
            <div class="preset-text">
              <span class="preset-title">Пустой блок</span>
              <span class="preset-description">Создать информационный блок с нуля</span>
            </div>
          </DropdownMenuItem>

          <template v-for="(presets, category) in groupedPresets" :key="category">
            <DropdownMenuSeparator class="dropdown-separator" />
            <DropdownMenuLabel class="category-label">
              {{ category }}
            </DropdownMenuLabel>
            <DropdownMenuItem
              v-for="preset in presets"
              :key="preset.templateName"
              class="preset-item"
              @click="applyPreset(preset)"
            >
              <div class="preset-icon-wrapper" :style="{ backgroundColor: `${preset.color}30` }">
                <Icon :icon="preset.icon || 'mdi:information-outline'" :style="{ color: preset.color }" />
              </div>
              <div class="preset-text">
                <span class="preset-title">{{ preset.templateName }}</span>
                <span class="preset-description">{{ preset.templateDescription }}</span>
              </div>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <!-- Viewer Dialog -->
    <KitDialogWithClose
      v-if="currentItem"
      v-model:visible="isViewerOpen"
      :title="currentItem.title"
      :icon="currentItem.icon"
      :max-width="1000"
      @update:visible="!$event && closeViewer()"
    >
      <KitInlineMdEditorWrapper :model-value="currentItem.content || ''" :readonly="true" />
    </KitDialogWithClose>

    <!-- Editor Dialog -->
    <KitDialogWithClose
      v-if="currentItem"
      v-model:visible="isEditorOpen"
      :title="currentItem.id && meta.some(m => m.id === currentItem?.id) ? 'Редактирование' : 'Новая информация'"
      icon="mdi:pencil-outline"
    >
      <div class="editor-form">
        <KitInput v-model="currentItem.title" label="Заголовок" placeholder="Название поля (напр. 'Темп')" />
        <KitInput v-model="currentItem.subtitle" label="Подзаголовок" placeholder="Значение поля (напр. 'Низкий')" />
        <div class="icon-picker">
          <label>Иконка</label>
          <KitInput v-model="iconSearchQuery" placeholder="Поиск иконки (напр. 'car')" icon="mdi:magnify" />
          <div class="icon-picker-grid">
            <button
              v-for="icon in filteredIcons"
              :key="icon"
              class="icon-option"
              :class="{ 'is-active': currentItem.icon === icon }"
              @click="currentItem.icon = icon"
            >
              <Icon :icon="icon" />
            </button>
          </div>
        </div>
        <div class="color-picker">
          <label>Цвет</label>
          <div class="color-options">
            <input v-model="currentItem.color" type="color" class="color-input">
            <button
              v-for="color in defaultColors"
              :key="color"
              class="color-option"
              :style="{ backgroundColor: color }"
              :class="{ 'is-active': currentItem.color === color }"
              @click="currentItem.color = color"
            />
          </div>
        </div>
        <div class="content-editor">
          <label>Содержимое (Markdown)</label>
          <KitInlineMdEditorWrapper v-model="currentItemContent" placeholder="Детальное описание, которое появится при клике..." />
        </div>
        <div class="editor-actions">
          <KitBtn variant="text" @click="closeEditor">
            Отмена
          </KitBtn>
          <KitBtn @click="handleSave">
            Сохранить
          </KitBtn>
        </div>
      </div>
    </KitDialogWithClose>

    <!-- Модальное окно с бронированиями -->
    <DayBookingsModal
      v-if="bookingsForSelectedDay.length > 0"
      v-model:visible="isBookingsModalOpen"
      :bookings="bookingsForSelectedDay"
    />
  </div>
</template>

<style scoped lang="scss">
.day-meta-badges-container {
  padding: 16px 0;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.badges-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  @include media-down(sm) {
    > div {
      flex-grow: 1;

      > button {
        width: 100%;
        justify-content: center;
      }
    }
  }
}

.badge-wrapper {
  position: relative;

  &:hover .badge-actions {
    opacity: 1;
    transform: translateY(0);
  }
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--r-s);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--s-m);
  }
}

.booking-badge {
  background-color: rgba(var(--fg-accent-color-rgb), 0.15);
  color: var(--fg-accent-color);
  border-color: rgba(var(--fg-accent-color-rgb), 0.3);
}

.badge-icon {
  font-size: 1.1rem;
}

.badge-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.badge-title {
  font-family: 'Sansation';
  font-weight: 600;
  font-size: 1rem;
}

.badge-subtitle {
  font-family: 'Sansation';
  font-weight: 500;
  font-size: 0.9rem;
}

.badge-actions {
  position: absolute;
  top: -12px;
  right: -8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(5px);
  transition: all 0.2s ease;
  z-index: 5;

  .action-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px;

    &.edit:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }

    &.delete:hover {
      color: var(--fg-error-color);
      border-color: var(--fg-error-color);
    }
  }
}

.add-badge-btn {
  width: fit-content;
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
}
.color-picker,
.icon-picker {
  label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}
.color-options {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
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

.color-input {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 50%;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding: 0;
  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  &::-webkit-color-swatch {
    border: 1px solid var(--border-secondary-color);
    border-radius: 50%;
  }
}

.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.content-editor {
  label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
  :deep(.kit-inline-md-editor-minimal .milkdown > div) {
    border: 1px solid var(--border-primary-color);
    border-radius: var(--r-s);
    padding: 8px;
  }
}

:deep(.add-badge-dropdown) {
  min-width: 300px;
  max-width: 350px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-l);
  z-index: 50;
  padding: 8px;
}

.dropdown-separator {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 6px -8px;
}

.category-label {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--r-s);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: background-color 0.2s ease;

  &[data-highlighted] {
    background: var(--bg-hover-color);
  }
}

.preset-icon-wrapper {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-s);

  .iconify {
    font-size: 18px;
    color: var(--fg-accent-color);
  }
}

.preset-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preset-title {
  font-weight: 500;
  color: var(--fg-primary-color);
  font-size: 14px;
}

.preset-description {
  font-size: 12px;
  color: var(--fg-secondary-color);
  white-space: normal;
}

:deep(.badge-tooltip-content) {
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  border-radius: var(--r-s);
  padding: 8px 12px;
  font-size: 0.875rem;
  line-height: 1.5;
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-l);
  max-width: 800px;
  z-index: 100;

  &[data-state='delayed-open'] {
    animation: tooltip-fade-in 0.2s ease-out;
  }
  &[data-state='closed'] {
    animation: tooltip-fade-out 0.2s ease-in;
  }
}

:deep(.badge-tooltip-arrow) {
  fill: var(--bg-secondary-color);
  stroke: var(--border-primary-color);
  stroke-width: 1;
}

@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes tooltip-fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>
