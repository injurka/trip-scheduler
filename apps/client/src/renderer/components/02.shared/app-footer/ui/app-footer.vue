<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { AppRouteNames } from '~/shared/constants/routes'
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-left">
        <span class="copyright">© 2025 TripScheduler</span>
        <div class="legal-links">
          <router-link :to="{ name: AppRouteNames.Terms }" class="legal-link">
            Условия
          </router-link>
          <router-link :to="{ name: AppRouteNames.Privacy }" class="legal-link">
            Конфиденциальность
          </router-link>
        </div>
      </div>
      <div class="spacer" />

      <div class="links">
        <router-link :to="{ name: AppRouteNames.UsefulLinks }" class="p-link" title="Полезные ссылки">
          <Icon width="20" height="20" icon="mdi:link-variant" color="var(--fg-primary-color)" />
        </router-link>
        <router-link :to="{ name: AppRouteNames.About }" class="p-link" title="О проекте">
          <Icon width="20" height="20" icon="mdi:information-outline" color="var(--fg-primary-color)" />
        </router-link>

        <a href="https://github.com/xsolare/trip-scheduler" target="_blank" rel="noopener noreferrer" class="p-link" title="GitHub">
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

  .footer-left {
    display: flex;
    flex-direction: column;
    gap: 4px;

    @include media-up(sm) {
      flex-direction: row;
      align-items: center;
      gap: 16px;
    }
  }

  .copyright {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .legal-links {
    display: flex;
    gap: 12px;
  }

  .legal-link {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: var(--fg-primary-color);
      text-decoration: underline;
    }
  }

  .links {
    display: flex;
    gap: 12px;

    .p-link {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.7;
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
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
