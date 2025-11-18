<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const modelValue = defineModel<string>({ required: true })

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

const isOpen = ref(false)
const pickerButton = ref<HTMLButtonElement | null>(null)
const dropdownPanel = ref<HTMLDivElement | null>(null)

const sizeClass = computed(() => `size-${props.size}`)

function selectIcon(icon: string) {
  modelValue.value = icon
  isOpen.value = false
}

function togglePicker() {
  isOpen.value = !isOpen.value
}

async function updateDropdownPosition() {
  await nextTick()

  if (!dropdownPanel.value)
    return

  dropdownPanel.value.style.transform = 'translateX(-50%)'

  const dropdownRect = dropdownPanel.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth

  let shiftX = 0

  if (dropdownRect.right > viewportWidth) {
    shiftX = viewportWidth - dropdownRect.right - 8
  }
  if (dropdownRect.left < 0) {
    shiftX = -dropdownRect.left + 8
  }

  if (shiftX !== 0) {
    dropdownPanel.value.style.transform = `translateX(calc(-50% + ${shiftX}px))`
  }
}

watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    updateDropdownPosition()
  }
})

onClickOutside(dropdownPanel, () => {
  isOpen.value = false
}, { ignore: [pickerButton] })
</script>

<template>
  <div class="icon-picker-wrapper">
    <button
      ref="pickerButton"
      class="picker-button"
      :class="sizeClass"
      @click="togglePicker"
    >
      <Icon width="20" height="20" :icon="modelValue || 'mdi:image-off-outline'" class="main-icon" />
      <Icon icon="mdi:chevron-down" class="chevron" :class="{ rotated: isOpen }" />
    </button>

    <Transition name="fade">
      <div
        v-if="isOpen"
        ref="dropdownPanel"
        class="icon-dropdown"
      >
        <div class="icon-grid">
          <button
            v-for="icon in sharedIconList"
            :key="icon"
            class="icon-option"
            :class="{ selected: icon === modelValue }"
            @click="selectIcon(icon)"
          >
            <Icon :icon="icon" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.icon-picker-wrapper {
  position: relative;
}

.picker-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  cursor: pointer;
  color: var(--fg-primary-color);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }

  .chevron {
    transition: transform 0.2s ease;
    flex-shrink: 0;
    &.rotated {
      transform: rotate(180deg);
    }
  }

  .main-icon {
    margin-right: 4px;
  }

  &.size-sm {
    height: 38px;
    padding: 0 10px;

    .main-icon {
      font-size: 1.2rem;
    }
  }
  &.size-md {
    height: 46px;
    padding: 0 12px;
    width: 62px;
    .main-icon {
      font-size: 1.4rem;
    }
  }
  &.size-lg {
    height: 54px;
    padding: 0 14px;
    width: 70px;
    .main-icon {
      font-size: 1.6rem;
    }
  }
}

.icon-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 184px;
  padding: 8px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: 8px;
}

.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.4rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
  &.selected {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-5px);
}
</style>
