<script setup lang="ts">
import { Icon, loadIcons } from '@iconify/vue'
import { useMouse } from '@vueuse/core'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

// --- Типы и Пропсы ---
interface Particle {
  id: number
  icon: string
  x: number
  y: number
  translateX: number
  translateY: number
  size: number
  alpha: number
  targetAlpha: number
  dx: number
  dy: number
  magnetism: number
}

const props = withDefaults(defineProps<{
  quantity?: number
  staticity?: number
  ease?: number
}>(), {
  quantity: 40,
  staticity: 50,
  ease: 100,
})

// --- Иконки ---
const travelIcons = [
  'mdi:airplane',
  'mdi:map-marker-outline',
  'mdi:compass-outline',
  'mdi:wallet-travel',
  'mdi:camera-outline',
  'mdi:food-fork-drink',
  'mdi:bed',
  'mdi:car',
  'mdi:train',
  'mdi:beach',
  'mdi:ticket-confirmation-outline',
  'mdi:passport',
  'mdi:briefcase-outline',
  'mdi:earth',
  'mdi:sun-compass',
  'mdi:sunglasses',
  'mdi:ship-wheel',
  'mdi:flag-variant-outline',
]

function getRandomIcon() {
  return travelIcons[Math.floor(Math.random() * travelIcons.length)]
}

// --- Реактивное состояние ---
const containerRef = ref<HTMLDivElement | null>(null)
const particles = ref<Particle[]>([])
const mouse = reactive({ x: 0, y: 0 })
const containerSize = reactive({ w: 0, h: 0 })
const { x: mouseX, y: mouseY } = useMouse()
let animationFrameId: number

// --- Инициализация ---
onMounted(() => {
  loadIcons(travelIcons)
  init()
  animate()
  window.addEventListener('resize', init)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', init)
  cancelAnimationFrame(animationFrameId)
})

watch([mouseX, mouseY], () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    mouse.x = mouseX.value - rect.left - containerSize.w / 2
    mouse.y = mouseY.value - rect.top - containerSize.h / 2
  }
})

// --- Логика анимации ---
function init() {
  if (containerRef.value) {
    containerSize.w = containerRef.value.offsetWidth
    containerSize.h = containerRef.value.offsetHeight
    particles.value = Array.from({ length: props.quantity }, (_, i) => createParticle(i))
  }
}

function createParticle(id: number): Particle {
  return {
    id,
    icon: getRandomIcon(),
    x: Math.random() * containerSize.w,
    y: Math.random() * containerSize.h,
    translateX: 0,
    translateY: 0,
    size: 0.8 + Math.random() * 0.7,
    alpha: 0,
    targetAlpha: Number.parseFloat((Math.random() * 0.15 + 0.05).toFixed(2)),
    dx: (Math.random() - 0.5) * 0.3,
    dy: (Math.random() - 0.5) * 0.3,
    magnetism: 0.1 + Math.random() * 4,
  }
}

function animate() {
  particles.value.forEach((p) => {
    // Постепенное появление
    if (p.alpha < p.targetAlpha)
      p.alpha += 0.01

    // Движение частицы под влиянием мыши (параллакс)
    p.translateX += (mouse.x / (props.staticity / p.magnetism) - p.translateX) / props.ease
    p.translateY += (mouse.y / (props.staticity / p.magnetism) - p.translateY) / props.ease

    // Собственное "дрейфующее" движение
    p.x += p.dx
    p.y += p.dy

    // Возвращение на экран при выходе за границы
    if (p.x < -20)
      p.x = containerSize.w + 20
    if (p.x > containerSize.w + 20)
      p.x = -20
    if (p.y < -20)
      p.y = containerSize.h + 20
    if (p.y > containerSize.h + 20)
      p.y = -20
  })

  animationFrameId = requestAnimationFrame(animate)
}
</script>

<template>
  <div ref="containerRef" class="interactive-icon-particles-bg">
    <div
      v-for="particle in particles"
      :key="particle.id"
      class="symbol"
      :style="{
        top: `${particle.y}px`,
        left: `${particle.x}px`,
        fontSize: `${particle.size}rem`,
        opacity: particle.alpha,
        transform: `translate(${particle.translateX}px, ${particle.translateY}px)`,
      }"
    >
      <Icon :icon="particle.icon" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.interactive-icon-particles-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.symbol {
  position: absolute;
  color: var(--fg-tertiary-color);
  will-change: transform, opacity;
}
</style>
