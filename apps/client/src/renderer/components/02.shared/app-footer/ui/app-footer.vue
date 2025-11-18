<script lang="ts" setup>
import { Icon } from '@iconify/vue'
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <span class="copyright">© 2025 TripScheduler</span>
      <div class="spacer" />

      <div class="links">
        <router-link :to="{ name: AppRouteNames.UsefulLinks }" class="p-link">
          <Icon width="20" height="20" icon="mdi:link-variant" color="var(--fg-primary-color)" />
        </router-link>
        <router-link :to="{ name: AppRouteNames.About }" class="p-link">
          <Icon width="20" height="20" icon="mdi:information-outline" color="var(--fg-primary-color)" />
        </router-link>

        <a href="https://github.com/xsolare/trip-scheduler" target="_blank" rel="noopener noreferrer" class="p-link">
          <Icon width="20" height="20" icon="mdi:github" color="var(--fg-primary-color)" />
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
  z-index: 9;

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
