<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { useElementBounding } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { ProfileDrawer } from '~/components/02.shared/profile-drawer'
import { useAppStore } from '~/shared/composables/use-store'
import { AppRouteNames, AppRoutePaths } from '~/shared/constants/routes'

const headerEl = ref<HTMLElement>()
const router = useRouter()
const route = useRoute()
const appStore = useAppStore(['auth', 'theme', 'layout'])

const isProfileDrawerOpen = ref(false)
const isNavMenuOpen = ref(false)

const isScrolled = ref(false)
const isHeaderVisible = ref(true)
const lastScrollY = ref(0)
const isSmallScreen = ref(false)

const { height: headerHeight } = useElementBounding(headerEl)

watch(headerHeight, newHeight => appStore.layout.setHeaderHeight(newHeight))
watch(isHeaderVisible, isVisible => appStore.layout.setHeaderVisibility(isVisible))

const navItems = [
  {
    id: 'trips',
    label: 'Приключения',
    desc: 'Ваши планы и маршруты',
    icon: 'mdi:compass-outline',
    color: 'var(--fg-accent-color)',
    bgColor: 'rgba(var(--fg-accent-color-rgb), 0.1)',
  },
  {
    id: 'activity-map',
    label: 'Карта активностей',
    desc: 'Планируйте дела на карте',
    icon: 'mdi:map-marker-radius',
    color: '#00bcd4',
    bgColor: 'rgba(0, 188, 212, 0.1)',
  },
  {
    id: 'posts',
    label: 'Посты',
    desc: 'Заметки и истории',
    icon: 'mdi:image-text',
    color: '#8e44ad',
    bgColor: 'rgba(142, 68, 173, 0.1)',
  },
  {
    id: 'links',
    label: 'Полезное',
    desc: 'Сервисы для туристов',
    icon: 'mdi:link-variant',
    color: '#27ae60',
    bgColor: 'rgba(39, 174, 96, 0.1)',
  },
  {
    id: 'blog',
    label: 'Блог',
    desc: 'Новости и обновления',
    icon: 'mdi:notebook-outline',
    color: '#e67e22',
    bgColor: 'rgba(230, 126, 34, 0.1)',
  },
]

function handleNavigation(item: typeof navItems[0]) {
  switch (item.id) {
    case 'trips':
      router.push({ name: AppRouteNames.TripList })
      break
    case 'activity-map':
      router.push({ name: AppRouteNames.ActivityMap })
      break
    case 'posts':
      router.push({ name: AppRouteNames.PostList })
      break
    case 'links':
      router.push({ name: AppRouteNames.UsefulLinks })
      break
    case 'blog':
      router.push({ name: AppRouteNames.BlogList })
      break
  }
  isNavMenuOpen.value = false
}

function checkScreenSize() {
  isSmallScreen.value = window.innerWidth < 1400
}

function goToSignIn() {
  router.push({
    path: AppRoutePaths.Auth.SignIn,
    query: { returnUrl: route.fullPath },
  })
}

onMounted(() => {
  let ticking = false
  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        if (currentScrollY > lastScrollY.value && currentScrollY > 100) {
          isHeaderVisible.value = false
        }
        else {
          isHeaderVisible.value = true
        }
        isScrolled.value = currentScrollY > 10
        lastScrollY.value = currentScrollY
        ticking = false
      })
      ticking = true
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })
})

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  onUnmounted(() => {
    window.removeEventListener('resize', checkScreenSize)
  })
})
</script>

<template>
  <header
    ref="headerEl"
    class="header"
    :class="{
      'header--scrolled': isScrolled,
      'header--hidden': !isHeaderVisible,
      'header--small-screen': isSmallScreen,
    }"
  >
    <div class="header-content">
      <div class="header-left">
        <KitDropdown
          v-model:open="isNavMenuOpen"
          align="start"
          :side-offset="8"
          class="nav-dropdown"
        >
          <template #trigger>
            <div class="logo-wrapper">
              <div class="logo">
                <Icon width="20" height="20" class="logo-icon" icon="mdi:map-marker-path" />
                <span class="logo-text">Trip Scheduler</span>
              </div>
            </div>
          </template>

          <div class="nav-menu-content">
            <div class="nav-menu-header">
              <span>Навигация</span>
            </div>
            <div class="nav-grid">
              <button
                v-for="item in navItems"
                :key="item.id"
                class="nav-item"
                @click="handleNavigation(item)"
              >
                <div class="nav-item-icon" :style="{ color: item.color, backgroundColor: item.bgColor }">
                  <Icon :icon="item.icon" />
                </div>
                <div class="nav-item-info">
                  <span class="nav-item-title">{{ item.label }}</span>
                  <span class="nav-item-desc">{{ item.desc }}</span>
                </div>
                <Icon icon="mdi:chevron-right" class="nav-arrow" />
              </button>
            </div>
          </div>
        </KitDropdown>
      </div>

      <div class="header-center">
        <slot name="center" />
      </div>

      <div class="header-right">
        <button
          class="util-btn"
          :class="{ 'is-active': appStore.layout.isFloatingMapOpen }"
          title="Открыть карту"
          @click="appStore.layout.toggleFloatingMap()"
        >
          <Icon icon="mdi:map-search-outline" />
        </button>

        <button class="util-btn" title="Настроить тему" @click="appStore.theme.openCreator()">
          <Icon icon="mdi:palette-outline" />
        </button>

        <div class="vr" />

        <div class="profile" @click="isProfileDrawerOpen = true">
          <KitAvatar
            v-if="appStore.auth.isAuthenticated"
            :src="`${appStore.auth.user?.avatarUrl}`"
          />
          <div
            v-else
            class="profile-img"
            @click.stop="goToSignIn"
          >
            <Icon
              icon="mdi:face-man-profile"
              style="font-size: 32px;"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="header-border" />
  </header>
  <ProfileDrawer v-model:open="isProfileDrawerOpen" />
</template>

<style lang="scss" scoped>
.header {
  position: sticky;
  top: var(--title-bar-height, 0px);
  display: flex;
  flex-direction: row;
  width: 100%;
  z-index: 7;
  transition:
    top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    backdrop-filter 0.3s ease,
    background-color 0.3s ease,
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s ease;
  padding-top: env(safe-area-inset-top);

  &--scrolled {
    backdrop-filter: blur(8px);
    background-color: var(--bg-primary-color-rgb);
    box-shadow: var(--s-s);

    .header-border {
      opacity: 1;
      transform: scaleX(1);
    }
  }

  &--hidden {
    transform: translateY(-100%);
  }

  &--small-screen {
    .header-content {
      grid-template-columns: auto 1fr auto;
      gap: 8px;
    }
    .header-center {
      display: none;
    }
    .header-left {
      justify-self: start;
    }
    .header-right {
      justify-self: end;
    }
  }

  &-content {
    width: 100%;
    height: 100%;
    margin: 0 auto;
    font-family: 'Rubik';
    padding: 0 12px;
    align-items: center;

    display: grid;
    grid-template-columns: 1fr minmax(auto, 1040px) 1fr;
    transition: grid-template-columns 0.3s ease;
  }

  &-left {
    justify-self: end;
    display: flex;
    align-items: center;
    margin: 8px;
    height: 40px;

    .logo-wrapper {
      padding: 0 16px;
      background-color: var(--bg-secondary-color);
      border-radius: 20px;
      transition:
        border-radius 0.5s cubic-bezier(0.4, 0, 0.2, 1),
        transform 0.2s ease,
        box-shadow 0.2s ease;
      height: 100%;
      display: flex;
      align-items: center;
      cursor: pointer;
      overflow: hidden;

      &:hover {
        border-radius: 10px;
        transform: translateY(-1px);
        box-shadow: var(--s-l);

        .logo-icon {
          transform: rotate(10deg) scale(1.1);
        }
      }

      &:active {
        transform: translateY(0);
      }
    }

    .logo {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &-icon {
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: var(--fg-primary-color);
      }

      &-text {
        font-family: 'Sansation';
        font-size: 1rem;
        font-weight: 600;
        position: relative;
        white-space: nowrap;
        color: var(--fg-primary-color);
      }
    }
  }

  &-center {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    position: relative;
  }

  &-right {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    margin: 8px;
    background-color: var(--bg-secondary-color);
    border-radius: 20px;
    transition:
      border-radius 0.5s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.2s ease,
      box-shadow 0.2s ease;
    height: 40px;

    &:hover {
      border-radius: 10px;
      transform: translateY(-1px);
      box-shadow: var(--s-l);
    }

    &:active {
      transform: translateY(0);
    }

    .util-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--r-xs);
      border: none;
      color: var(--fg-secondary-color);
      cursor: pointer;
      transition:
        all 0.2s ease,
        transform 0.1s ease;
      font-size: 1.2rem;
      overflow: hidden;
      position: relative;
      background: transparent;

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background-color: var(--fg-accent-color);
        border-radius: 50%;
        transition: all 0.3s ease;
        transform: translate(-50%, -50%);
        opacity: 0.1;
        z-index: -1;
      }

      &:hover,
      &.is-active {
        color: var(--fg-accent-color);
        transform: scale(1.1);

        &::before {
          width: 100%;
          height: 100%;
        }
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .profile {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      &-img {
        border-radius: var(--r-full);
        border: 1px solid var(--border-primary-color);
        overflow: hidden;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          border-color 0.2s ease-in-out,
          transform 0.2s ease,
          box-shadow 0.2s ease;

        &:hover {
          border-color: var(--border-accent-color);
          transform: scale(1.05);
          box-shadow: 0 2px 8px var(--border-accent-color);
        }
      }
    }
  }

  .vr {
    margin: 0;
    height: 20px;
    width: 1px;
    background-color: var(--border-secondary-color);
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  &-border {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-accent-color), transparent);
    opacity: 0;
    transform: scaleX(0);
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }
}

.nav-menu-content {
  width: 280px;
  padding: 0;
  border-radius: var(--r-m);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-menu-header {
  padding: 8px 12px 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-tertiary-color);
}

.nav-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--r-s);
  border: 1px solid transparent;
  background-color: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  width: 100%;

  &:hover {
    background-color: var(--bg-secondary-color);
    border-color: var(--border-secondary-color);
    transform: translateX(4px);

    .nav-arrow {
      opacity: 1;
      transform: translateX(0);
    }
  }

  &-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  &:hover &-icon {
    transform: scale(1.1) rotate(5deg);
  }

  &-info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.2;
  }

  &-desc {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    line-height: 1.2;
  }

  .nav-arrow {
    color: var(--fg-tertiary-color);
    font-size: 1.1rem;
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.2s ease;
  }
}

:deep(.nav-dropdown) {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  overflow: visible !important;
}

@include media-down(sm) {
  .header {
    &-content {
      padding: 0 8px;
      grid-template-columns: auto 1fr auto;
      gap: 4px;
    }

    &-center {
      display: none;
    }

    &-left {
      margin: 6px;
      width: 40px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      .logo-wrapper {
        padding: 0;
        justify-content: center;
        width: 100%;
      }

      .logo-text {
        display: none;
        white-space: nowrap;
      }
    }

    &-right {
      margin: 4px;
      gap: 4px;
    }
  }
}
</style>
