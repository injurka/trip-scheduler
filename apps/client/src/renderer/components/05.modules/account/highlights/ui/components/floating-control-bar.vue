<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { KitInput } from '~/components/01.kit/kit-input'

const props = defineProps<{
  quality: 'fast' | 'detailed' | 'original'
  filterMode: 'all' | 'trips' | 'dates'
  dateRange: { start: string, end: string }
  scrollContainer: HTMLElement | null
}>()

const emit = defineEmits(['update:quality', 'update:filterMode', 'update:dateRange'])

const isVisible = ref(true)
const isPopoverOpen = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

// Логика появления панели только при остановке скролла
function handleScroll() {
  isVisible.value = false
  if (scrollTimeout)
    clearTimeout(scrollTimeout)

  scrollTimeout = setTimeout(() => {
    isVisible.value = true
  }, 200)
}

watch(() => props.scrollContainer, (el, oldEl) => {
  if (oldEl)
    oldEl.removeEventListener('scroll', handleScroll)
  if (el)
    el.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  if (props.scrollContainer)
    props.scrollContainer.removeEventListener('scroll', handleScroll)
})

const filterLabel = computed(() => {
  if (props.filterMode === 'all')
    return 'Всё подряд'
  if (props.filterMode === 'trips')
    return 'По путешествиям'
  if (props.filterMode === 'dates')
    return 'По датам'
  return 'Всё подряд'
})

function setQuality(q: typeof props.quality) { emit('update:quality', q) }
function setFilterMode(m: typeof props.filterMode) { emit('update:filterMode', m); isPopoverOpen.value = false }
</script>

<template>
  <div class="floating-control-bar" :class="{ hidden: !isVisible && !isPopoverOpen }">
    <div class="bar-content">
      <!-- Слева: Фильтры -->
      <div class="filter-section">
        <button class="filter-toggle" @click="isPopoverOpen = !isPopoverOpen">
          Показывать: <strong>{{ filterLabel }}</strong>
          <Icon icon="mdi:chevron-down" />
        </button>

        <div v-if="isPopoverOpen" class="popover">
          <div class="popover-tabs">
            <button :class="{ active: filterMode === 'all' }" @click="setFilterMode('all')">
              Всё
            </button>
            <button :class="{ active: filterMode === 'trips' }" @click="setFilterMode('trips')">
              Поездки
            </button>
            <button :class="{ active: filterMode === 'dates' }" @click="setFilterMode('dates')">
              Даты
            </button>
          </div>

          <div v-if="filterMode === 'dates'" class="date-inputs">
            <KitInput v-model="dateRange.start" placeholder="ММ.ГГГГ" />
            <span>—</span>
            <KitInput v-model="dateRange.end" placeholder="ММ.ГГГГ" />
          </div>
        </div>
      </div>

      <!-- Справа: Качество (Segmented Control) -->
      <div class="quality-section">
        <div class="segmented-control">
          <button :class="{ active: quality === 'fast' }" @click="setQuality('fast')">
            Быстро
          </button>
          <button :class="{ active: quality === 'detailed' }" @click="setQuality('detailed')">
            Детально
          </button>
          <button :class="{ active: quality === 'original' }" @click="setQuality('original')">
            Оригинал
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.floating-control-bar {
  position: absolute;
  top: 80px; /* Отступ от ViewSwitcher'a сверху */
  left: 50%;
  transform: translateX(-50%) translateY(0);
  z-index: 100;

  /* Эффект Glassmorphism */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--r-full);

  padding: 8px 16px;
  transition:
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.4s ease;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);

  &.hidden {
    transform: translateX(-50%) translateY(-150%);
    opacity: 0;
    pointer-events: none;
  }
}

.bar-content {
  display: flex;
  align-items: center;
  gap: 32px;
}

.filter-section {
  position: relative;
}

.filter-toggle {
  background: none;
  border: none;
  color: white;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--r-s);
  transition: background 0.2s;
  strong {
    font-weight: 600;
  }
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.popover {
  position: absolute;
  top: calc(100% + 16px);
  left: 0;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px;
  box-shadow: var(--s-xl);
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.popover-tabs {
  display: flex;
  gap: 4px;
  button {
    flex: 1;
    background: none;
    border: none;
    padding: 6px 8px;
    font-size: 0.8rem;
    border-radius: var(--r-xs);
    cursor: pointer;
    color: var(--fg-secondary-color);
    transition: all 0.2s;
    &.active {
      background: var(--bg-primary-color);
      color: var(--fg-primary-color);
      box-shadow: var(--s-xs);
    }
  }
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  span {
    color: var(--fg-secondary-color);
  }
}

.segmented-control {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--r-full);
  padding: 4px;

  button {
    background: none;
    border: none;
    padding: 6px 16px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    border-radius: var(--r-full);
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-weight: 600;
    }
  }
}

@media (max-width: 768px) {
  .floating-control-bar {
    top: 70px;
    border-radius: var(--r-l);
    width: 90%;
  }
  .bar-content {
    gap: 12px;
    flex-direction: column;
  }
}
</style>
