<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { HaoticLines } from '~/components/domain/haotic-lines'

const sentinelEl = ref<HTMLElement>()
const headerEl = ref<HTMLElement>()
const isSticky = ref<boolean>(false)

onMounted(() => {
  if (sentinelEl.value) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isSticky.value = entry.isIntersecting
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0,
      },
    )

    observer.observe(sentinelEl.value)

    onBeforeUnmount(() => {
      observer.disconnect()
    })
  }
})
</script>

<template>
  <div ref="sentinelEl" class="sentinel" />
  <header
    ref="headerEl"
    class="header"
    :class="{ blurred: !isSticky }"
  >
    <ClientOnly>
      <HaoticLines :viewport-el="headerEl" />
    </ClientOnly>

    <div class="header-content">
      <div class="header-nav">
        <div class="logo">
          <Icon class="logo-icon" icon="mdi:map-marker-path" style="font-size: 32px;" />
          Trip Scheduler
        </div>
      </div>

      <div class="header-utils">
        <div class="vr" />

        <div class="profile">
          <div class="profile-img">
            <Icon
              icon="mdi:face-man-profile"
              style="font-size: 64px;"
            />
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.sentinel {
  position: absolute;
  top: 0;
  height: 0;
  width: 100%;
}

.header {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  flex-direction: row;
  border-bottom: 1px solid var(--border-primary-color);
  height: #{$header-height};
  background-color: rgb(var(--bg-header-color));
  width: 100%;
  overflow: hidden;
  z-index: 100;
  transition:
    background-color 0.3s ease,
    backdrop-filter 0.3s ease;

  &.blurred {
    background-color: rgba(var(--bg-header-color), 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  &-content {
    max-width: 1200px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin: 0 auto;
    z-index: 6;
    font-family: 'Rubik';
    padding: 0 8px;

    > div {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &-nav {
    .logo {
      display: inline-flex;
      align-items: center;
      margin: 0 8px;
      gap: 8px;

      &-title {
        margin-left: 8px;
      }
    }

    ul {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      padding: 0 10px;

      li {
        list-style: none;
        text-decoration: none;

        span {
          margin-right: 4px;
        }
      }
    }

    .link {
      color: var(--fg-primary-color);
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease-in-out;
      padding: 2px 8px;

      &:hover {
        color: var(--fg-action-color);
        background-color: var(--bg-tertiary-color);
        box-shadow: 0px 0px 0px 1px var(--border-accent-color);
      }

      &.actived {
        color: var(--fg-accent-color);
      }
    }
  }

  .profile {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;

    &-img {
      border-radius: 50%;
      border: 2px solid var(--border-primary-color);
      overflow: hidden;
      cursor: pointer;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;

      transition: border 0.2s ease-in-out;
      &:hover {
        border: 2px solid var(--border-accent-color);
      }
    }
  }
}

.vr {
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  letter-spacing: normal;
  font-weight: 400;
  color: var(--fg-muted-color);
}
</style>
