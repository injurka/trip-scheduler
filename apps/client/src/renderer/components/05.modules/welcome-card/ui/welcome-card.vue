<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useMouse } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { BackgroundParallaxEffects } from '~/components/02.shared/background-parallax-effects'

const router = useRouter()

const cardRef = ref<HTMLElement | null>(null)
const transformStyle = ref('')
const isHovering = ref(false)
const isMobile = ref(false)

const { x, y } = useMouse({ touch: false })

function detectMobile() {
  if (typeof window !== 'undefined') {
    isMobile.value = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
  }
}

onMounted(() => {
  detectMobile()
})

function goToTrips() {
  router.push(AppRoutePaths.Trip.List)
}

function goToCommunity() {
  router.push(AppRoutePaths.Communities.List)
}

function goToPlaces() {
  router.push(AppRoutePaths.Explore)
}

function goToUsefulLinks() {
  router.push(AppRoutePaths.UsefulLinks)
}

function onMouseMove() {
  if (!cardRef.value || isMobile.value)
    return

  const rect = cardRef.value.getBoundingClientRect()
  const mouseX = x.value - rect.left
  const mouseY = y.value - rect.top
  const xPercent = mouseX / rect.width
  const yPercent = mouseY / rect.height
  const rotateXFactor = (yPercent - 0.5) * 2
  const rotateYFactor = (xPercent - 0.5) * 2

  const maxRotate = 8
  const perspective = 1000
  const rotateX = rotateXFactor * maxRotate * -1
  const rotateY = rotateYFactor * maxRotate

  transformStyle.value = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`
}

function onMouseEnter() {
  if (isMobile.value)
    return
  isHovering.value = true
}

function onMouseLeave() {
  if (isMobile.value)
    return
  isHovering.value = false
  transformStyle.value = ''
}

const cardEventListeners = computed(() => {
  if (isMobile.value) {
    return {}
  }
  return {
    mouseenter: onMouseEnter,
    mousemove: onMouseMove,
    mouseleave: onMouseLeave,
  }
})
</script>

<template>
  <div class="welcome-page">
    <BackgroundParallaxEffects
      class="particles-background"
      :quantity="60"
      :ease="100"
      :staticity="30"
    />

    <!-- <div class="feature-card" @click="goToCommunity">
      <div class="feature-icon">
        <Icon icon="mdi:account-group-outline" />
      </div>
      <h2 class="feature-title">
        Сообщества
      </h2>
      <p class="feature-subtitle">
        Обсуждайте маршруты и находите попутчиков.
      </p>
    </div> -->

    <div
      ref="cardRef"
      class="welcome-card"
      :class="{ 'is-transitioning': !isHovering }"
      :style="{ transform: transformStyle }"
      v-on="cardEventListeners"
    >
      <div class="card-content">
        <div class="logo-accent">
          <Icon icon="mdi:map-marker-path" />
        </div>
        <h1 class="title">
          Trip Scheduler
        </h1>
        <p class="subtitle">
          Ваш умный помощник для создания идеальных маршрутов, организации
          планов и незабываемых впечатлений.
        </p>
        <KitBtn class="btn" @click="goToTrips">
          <Icon icon="mdi:compass-rose" />
          <span>К моим путешествиям</span>
        </KitBtn>
      </div>
    </div>

    <!-- <div class="feature-card" @click="goToPlaces">
      <div class="feature-icon">
        <Icon icon="mdi:map-search-outline" />
      </div>
      <h2 class="feature-title">
        Интересные места
      </h2>
      <p class="feature-subtitle">
        Иследуйте популярные локации и достопримечательности.
      </p>
    </div> -->

    <button class="useful-links-button" @click="goToUsefulLinks">
      <Icon icon="mdi:link-variant" class="link-icon" />
      <span class="link-text">Полезные ссылки</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.welcome-page {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
  width: 100%;
  min-height: 100%;
  padding: 16px;
  animation: fadeIn 0.8s ease-out forwards;
  overflow: hidden;
  background: linear-gradient(160deg, var(--bg-primary-color) 0%, var(--bg-tertiary-color) 50%);

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: center;
    gap: 40px;
  }
}

.particles-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.useful-links-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10;
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-secondary-color);
  border-radius: 44px;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: var(--s-m);

  .link-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .link-text {
    font-weight: 500;
    font-size: 0.9rem;
    white-space: nowrap;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
  }

  &:hover {
    gap: 12px;
    padding: 0 20px;
    color: var(--fg-accent-color);
    border-color: var(--border-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.7);

    .link-text {
      max-width: 200px;
      opacity: 1;
      margin-left: 4px;
    }
  }
}

.feature-card,
.welcome-card {
  background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 1;
}

.feature-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-xl);
  box-shadow: var(--s-l);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  max-width: 400px;
  width: 100%;

  @media (min-width: 1024px) {
    max-width: 300px;
    flex-shrink: 0;
  }

  &:hover {
    transform: translateY(-8px);
    box-shadow: var(--s-xl);
    border-color: var(--border-primary-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.7);

    .feature-icon {
      transform: scale(1.1);
      color: var(--fg-accent-color);
    }
  }

  .feature-icon {
    font-size: 3rem;
    color: var(--fg-secondary-color);
    margin-bottom: 24px;
    transition: all 0.3s ease;
  }

  .feature-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0 0 12px;
  }

  .feature-subtitle {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.6;
    margin: 0;
  }
}

@media (hover: none) and (pointer: coarse) {
  .welcome-card,
  .feature-card {
    transform: none !important;
  }
}

.welcome-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-xl);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-xl);
  max-width: 600px;
  width: 100%;
  will-change: transform;
  order: -1;

  @media (min-width: 1024px) {
    order: initial;
  }
}

.welcome-card.is-transitioning {
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

.card-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px;
  user-select: none;

  .title {
    font-size: 2.75rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 0 0 16px 0;
    line-height: 48px;
    letter-spacing: -1px;
    background: linear-gradient(90deg, var(--fg-accent-color), #5e72e4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    max-width: 450px;
    line-height: 1.6;
    margin-bottom: 32px;
  }

  .btn {
    border-radius: var(--r-xl);
  }
}

.logo-accent {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);
  font-size: 4rem;
  margin-bottom: 24px;
  animation: float 4s ease-in-out infinite;
  text-shadow: 0 0 20px var(--fg-accent-color);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}
</style>
