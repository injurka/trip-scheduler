<script lang="ts" setup>
// Импорты не требуются, так как мы используем стандартные HTML-элементы
// вместо компонентов PrimeVue для этого простого футера
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <span class="copyright">© 2025 TripScheduler</span>
      <div class="spacer" />

      <div class="links">
        <a href="/about" target="_blank" rel="noopener noreferrer" class="p-link">
          <i class="pi pi-info-circle" style="font-size: 0.875rem; color: var(--fg-primary-color)" />
        </a>

        <a href="https://github.com/injurka/chinisik" target="_blank" rel="noopener noreferrer" class="p-link">
          <i class="pi pi-github" style="font-size: 0.875rem; color: var(--fg-primary-color)" />
        </a>
      </div>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.footer {
  background-color: var(--bg-secondary-color);
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: center;
  padding: 1rem;

  .copyright {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .links {
    display: flex;
    gap: 8px;

    .p-link {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;

      &:hover {
        opacity: 0.8;
      }
    }
  }

  .spacer {
    flex: 1 1 auto;
  }

  &-content {
    display: flex;
    align-items: center;
    max-width: 1200px;
    width: 100%;
    color: var(--fg-primary-color);
  }
}
</style>
