<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { inject } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { TripsHubKey } from '../../../composables/use-trips-hub'

const tripsHub = inject(TripsHubKey)

if (!tripsHub) {
  throw new Error('TripsHub logic was not provided.')
}
</script>

<template>
  <div class="state-container">
    <div class="content">
      <Icon
        icon="mdi:package-variant-closed-remove"
        class="image"
        width="150"
        height="150"
      />
      <h3 class="title">
        Путешествий пока нет
      </h3>
      <p class="message">
        Самое время запланировать ваше следующее приключение!
      </p>
      <KitBtn @click="tripsHub.openCreateModal">
        <Icon icon="mdi:plus" />
        Создать путешествие
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.state-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px;
  text-align: center;
  color: var(--fg-secondary-color);
  width: 100%;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  margin-top: 16px;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.image {
  opacity: 0.7;
  margin-bottom: 16px;
  color: var(--fg-secondary-color);
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
}

.message {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  margin: 0 0 8px;
  max-width: 320px;
  line-height: 1.5;
}
</style>
