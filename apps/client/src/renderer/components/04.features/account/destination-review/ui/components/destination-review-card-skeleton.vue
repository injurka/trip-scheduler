<script setup lang="ts">
// Компонент-скелетон для карточки впечатлений
</script>

<template>
  <div class="review-card-skeleton">
    <!-- Имитация фона (картинки) -->
    <div class="skeleton-bg skeleton-pulse" />

    <!-- Имитация боковой панели с оценками-звездами -->
    <div class="mini-metrics-column">
      <div v-for="i in 3" :key="i" class="skeleton-metric skeleton-pulse" />
    </div>

    <!-- Имитация контента внизу карточки -->
    <div class="card-content">
      <div class="header-section">
        <!-- Имитация круглой оценки -->
        <div class="skeleton-wreath skeleton-pulse" />
        <!-- Имитация заголовка (город, страна) -->
        <div class="skeleton-title skeleton-pulse" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.review-card-skeleton {
  position: relative;
  border-radius: var(--r-l);
  overflow: hidden;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: var(--bg-secondary-color);
  box-shadow: var(--s-m);
}

.skeleton-bg {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--bg-tertiary-color);
}

.mini-metrics-column {
  position: absolute;
  top: 16px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-metric {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--border-secondary-color);
}

.card-content {
  position: relative;
  z-index: 5;
  padding: 20px;
}

.header-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-wreath {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--border-secondary-color);
}

.skeleton-title {
  height: 24px;
  width: 60%;
  border-radius: var(--r-s);
  background: var(--border-secondary-color);
}

/* Общая анимация пульсации для всех скелет-элементов */
.skeleton-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.4;
  }
}
</style>
