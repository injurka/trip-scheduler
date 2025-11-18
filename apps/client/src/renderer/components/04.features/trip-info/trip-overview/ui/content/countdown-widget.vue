<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

interface Props {
  targetDate: string
}

const props = defineProps<Props>()

const { pause, resume } = useIntervalFn(
  updateCountdown,
  1000,
  { immediate: false },
)

const timeLeft = ref({
  days: '00',
  hours: '00',
  minutes: '00',
  seconds: '00',
})

function updateCountdown() {
  const target = new Date(props.targetDate).getTime()
  const now = new Date().getTime()
  const difference = target - now

  if (difference <= 0) {
    timeLeft.value = { days: '00', hours: '00', minutes: '00', seconds: '00' }
    pause()
    return
  }

  timeLeft.value.days = String(Math.floor(difference / (1000 * 60 * 60 * 24))).padStart(2, '0')
  timeLeft.value.hours = String(Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0')
  timeLeft.value.minutes = String(Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0')
  timeLeft.value.seconds = String(Math.floor((difference % (1000 * 60)) / 1000)).padStart(2, '0')
}

onMounted(() => {
  updateCountdown()
  resume()
})

onUnmounted(() => {
  pause()
})
</script>

<template>
  <div class="countdown-container">
    <h3 class="countdown-title">
      До начала путешествия
    </h3>
    <div class="countdown-widget">
      <div class="time-segment">
        <div class="number-container">
          <Transition name="flip" mode="out-in">
            <span :key="timeLeft.days" class="number">{{ timeLeft.days }}</span>
          </Transition>
        </div>
        <span class="label">Дней</span>
      </div>
      <div class="separator">
        :
      </div>
      <div class="time-segment">
        <div class="number-container">
          <Transition name="flip" mode="out-in">
            <span :key="timeLeft.hours" class="number">{{ timeLeft.hours }}</span>
          </Transition>
        </div>
        <span class="label">Часов</span>
      </div>
      <div class="separator">
        :
      </div>
      <div class="time-segment">
        <div class="number-container">
          <Transition name="flip" mode="out-in">
            <span :key="timeLeft.minutes" class="number">{{ timeLeft.minutes }}</span>
          </Transition>
        </div>
        <span class="label">Минут</span>
      </div>
      <div class="separator">
        :
      </div>
      <div class="time-segment">
        <div class="number-container">
          <Transition name="flip" mode="out-in">
            <span :key="timeLeft.seconds" class="number">{{ timeLeft.seconds }}</span>
          </Transition>
        </div>
        <span class="label">Секунд</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/_setup.scss' as *;

.countdown-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.countdown-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  margin: 0;
}

.countdown-widget {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-m);
  backdrop-filter: blur(5px);
  border: 1px solid var(--border-secondary-color);
  width: fit-content;
}

.trip-started-message {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-success-color);
  padding: 0.5rem 1rem;
}

.time-segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 60px;
}

.number-container {
  height: 2.5rem;
  perspective: 300px;
}

.number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  font-family: 'Rubik', sans-serif;
  line-height: 1.2;
}

.label {
  font-size: 0.7rem;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
}

.separator {
  font-size: 2rem;
  font-weight: 700;
  color: var(--fg-tertiary-color);
  animation: blink 1.5s infinite;
}

@keyframes blink {
  50% {
    opacity: 0.5;
  }
}

/* Flip Animation */
.flip-enter-active,
.flip-leave-active {
  transition: all 0.4s cubic-bezier(0.55, 0, 0.1, 1);
}

.flip-enter-from {
  transform: translateY(0.8em) rotateX(-90deg);
  opacity: 0;
}

.flip-leave-to {
  transform: translateY(-0.8em) rotateX(90deg);
  opacity: 0;
}

@include media-down(sm) {
  .countdown-widget {
    gap: 0.25rem;
    padding: 0.5rem;
  }
  .time-segment {
    min-width: 45px;
  }
  .number {
    font-size: 1.5rem;
  }
  .separator {
    font-size: 1.5rem;
  }
}
</style>
