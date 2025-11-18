<script setup lang="ts">
import { useModuleStore } from '../../composables/use-trip-info-module'

const store = useModuleStore(['plan'])
</script>

<template>
  <div class="trip-content-empty">
    <p>Пока не создано ни одного дня для вашего путешествия.</p>
    <button @click="store.plan.addNewDay">
      Создать первый день
    </button>
  </div>
</template>

<style scoped lang="scss">
.trip-content-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--fg-secondary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  min-height: 300px;
  margin-top: 24px;

  p {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    margin-bottom: 24px;
  }

  button {
    padding: 12px 24px;
    border-radius: var(--r-s);
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--fg-accent-color-hover);
    }
  }
}
</style>
