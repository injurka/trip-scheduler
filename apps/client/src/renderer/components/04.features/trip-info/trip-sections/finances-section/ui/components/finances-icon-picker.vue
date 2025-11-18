<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { watch } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useFinancesIconPicker } from '../../composables/use-finances-icon-picker'

interface Props {
  visible: boolean
  currentIcon: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', icon: string): void
}>()

const { iconSearchQuery, filteredIcons } = useFinancesIconPicker()

function selectIcon(icon: string) {
  emit('select', icon)
  emit('update:visible', false)
}

watch(() => props.visible, (isVisible) => {
  if (!isVisible)
    iconSearchQuery.value = ''
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Выберите иконку"
    icon="mdi:emoticon-happy-outline"
    :max-width="400"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="icon-picker">
      <KitInput v-model="iconSearchQuery" placeholder="Поиск иконки (напр. 'food')" icon="mdi:magnify" />
      <div class="icon-picker-grid">
        <button
          v-for="icon in filteredIcons"
          :key="icon"
          type="button"
          class="icon-option"
          :class="{ 'is-active': currentIcon === icon }"
          @click="selectIcon(icon)"
        >
          <Icon :icon="icon" />
        </button>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}
.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 8px;
  max-height: 250px;
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
