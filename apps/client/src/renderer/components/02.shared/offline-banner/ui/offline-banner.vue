<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { DropdownMenuItem } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { useDataTimestamp } from '~/shared/composables/use-data-timestamp'
import { useConnectivity } from '~/shared/lib/connectivity'

const { isOnline, forcedOffline, setForcedOffline } = useConnectivity()
const { lastDataTimestamp } = useDataTimestamp()

const isOpen = ref(false)

const reason = computed(() => forcedOffline.value ? 'Офлайн-режим включён' : 'Нет подключения к сети')
const formattedDate = computed(() => {
  if (!lastDataTimestamp.value)
    return null

  return new Date(lastDataTimestamp.value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
})

watch(isOnline, () => {
  isOpen.value = false
})

function goOnline() {
  isOpen.value = false
  setForcedOffline(false)
}
</script>

<template>
  <div
    v-if="!isOnline"
    class="offline-status"
    role="status"
    aria-live="polite"
  >
    <KitDropdown v-model:open="isOpen" align="center" content-class="offline-status-menu">
      <template #trigger>
        <button class="offline-status-trigger" type="button" :aria-label="`${reason}. Показать подробности`">
          <Icon icon="mdi:cloud-off-outline" aria-hidden="true" />
          <span>Офлайн</span>
          <Icon class="offline-status-chevron" icon="mdi:chevron-down" aria-hidden="true" />
        </button>
      </template>

      <div class="offline-status-details">
        <p class="offline-status-title">
          {{ reason }}
        </p>
        <p>Режим чтения. Доступны сохранённые на устройстве данные.</p>
        <p class="offline-status-updated">
          {{ formattedDate ? `Последнее обновление: ${formattedDate}` : 'Показаны данные из кеша' }}
        </p>
      </div>
      <DropdownMenuItem
        v-if="forcedOffline"
        class="kit-dropdown-item kit-dropdown-item--md"
        @select="goOnline"
      >
        <Icon icon="mdi:cloud-check-outline" aria-hidden="true" />
        <span>Выключить офлайн-режим</span>
      </DropdownMenuItem>
    </KitDropdown>
  </div>
</template>

<style scoped lang="scss">
.offline-status {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.offline-status-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  min-width: 44px;
  max-width: 100%;
  padding: 0 10px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-full, 24px);
  background: var(--bg-warning-color);
  color: var(--fg-primary-color);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  > .iconify {
    flex-shrink: 0;
    color: var(--fg-warning-color);
    width: 18px;
    height: 18px;
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

  @media (max-width: 360px) {
    gap: 4px;
    padding: 0 8px;

    .offline-status-chevron {
      display: none;
    }
  }
}

.offline-status-details {
  padding: 10px;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  line-height: 1.5;

  p {
    margin: 0;
  }

  p + p {
    margin-top: 8px;
  }

  .offline-status-title {
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .offline-status-updated {
    font-size: 0.8rem;
  }
}
</style>

<style lang="scss">
.offline-status-menu {
  width: 288px;
  max-width: calc(100vw - 24px);
}
</style>
