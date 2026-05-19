<template>
  <div class="trip-map-empty">
    <span class="trip-map-empty-icon">🗺️</span>
    <p class="trip-map-empty-text">
      Добавьте впечатление с координатами —<br>оно появится на карте
    </p>
  </div>
</template>

<style scoped lang="scss">
.trip-map-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  pointer-events: none;
  text-align: center;
}

.trip-map-empty-icon {
  font-size: 2.5rem;
  line-height: 1;
  opacity: 0.4;
}

.trip-map-empty-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
}
</style>
