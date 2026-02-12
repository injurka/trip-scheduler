<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { AppRouteNames } from '~/shared/constants/routes'
</script>

<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="footer-info">
        <span class="copyright">© 2025 TripScheduler</span>

        <div class="divider-dot" />

        <nav class="legal-links">
          <router-link :to="{ name: AppRouteNames.Terms }" class="legal-link">
            Условия
          </router-link>
          <router-link :to="{ name: AppRouteNames.Privacy }" class="legal-link">
            Конфиденциальность
          </router-link>
          <router-link :to="{ name: AppRouteNames.OssLicenses }" class="legal-link">
            Лицензии OSS
          </router-link>
          <router-link :to="{ name: AppRouteNames.BlogList }" class="legal-link">
            Блог
          </router-link>
        </nav>
      </div>

      <div class="footer-socials">
        <router-link
          :to="{ name: AppRouteNames.UsefulLinks }"
          class="icon-link"
          title="Полезные ссылки"
        >
          <Icon icon="mdi:link-variant" />
        </router-link>

        <router-link
          :to="{ name: AppRouteNames.About }"
          class="icon-link"
          title="О проекте"
        >
          <Icon icon="mdi:information-outline" />
        </router-link>

        <a
          href="https://github.com/xsolare/trip-scheduler"
          target="_blank"
          rel="noopener noreferrer"
          class="icon-link"
          title="GitHub"
        >
          <Icon icon="mdi:github" />
        </a>
      </div>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.app-footer {
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(var(--border-primary-color-rgb), 0.2);
  background-color: rgba(var(--bg-primary-color-rgb), 0.5);
  padding: 0.5rem 1rem;
  margin-top: auto;
  z-index: 10;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  @include media-down(sm) {
    flex-direction: column-reverse;
    gap: 16px;
  }
}

.footer-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;

  @include media-down(sm) {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
}

.copyright {
  font-weight: 500;
  opacity: 0.8;
}

.divider-dot {
  width: 4px;
  height: 4px;
  background-color: var(--fg-tertiary-color);
  border-radius: 50%;

  @include media-down(sm) {
    display: none;
  }
}

.legal-links {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  @include media-down(sm) {
    justify-content: center;
    gap: 12px;
  }
}

.legal-link {
  color: var(--fg-secondary-color);
  text-decoration: none;
  transition: color 0.2s ease;
  position: relative;

  &:hover {
    color: var(--fg-primary-color);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }
}

.footer-socials {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--fg-secondary-color);
  background-color: transparent;
  transition: all 0.2s ease;
  font-size: 1.25rem;

  &:hover {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
