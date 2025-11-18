<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

interface Props {
  url?: string
  label: string
}

const props = defineProps<Props>()

// A configuration for known booking sources
const SOURCE_CONFIG = {
  'booking.com': { name: 'Booking.com', icon: 'simple-icons:bookingdotcom', color: '#003580' },
  'trip.com': { name: 'Trip.com', icon: 'simple-icons:tripdotcom', color: '#3264ff' },
  'tripadvisor.com': { name: 'TripAdvisor', icon: 'simple-icons:tripadvisor', color: '#34e0a1' },
  'airbnb.com': { name: 'Airbnb', icon: 'simple-icons:airbnb', color: '#ff5a5f' },
  'expedia.com': { name: 'Expedia', icon: 'simple-icons:expedia', color: '#1a1a1a' },
  'kayak.com': { name: 'Kayak', icon: 'simple-icons:kayak', color: '#ff6700' },
  'aviasales.ru': { name: 'Aviasales', icon: 'arcticons:aviasales', color: '#00b1e1' },
  'tutu.ru': { name: 'Tutu.ru', icon: 'mdi:tram', color: '#ff4a14' }, // No specific icon, using a generic one
  'rzd.ru': { name: 'РЖД', icon: 'mdi:train', color: '#e31e24' },
} as const

type KnownSource = keyof typeof SOURCE_CONFIG

const sourceInfo = computed(() => {
  if (!props.url)
    return null

  try {
    const urlObject = new URL(props.url)
    const hostname = urlObject.hostname.replace(/^www\./, '') // remove www.

    for (const key in SOURCE_CONFIG) {
      if (hostname.includes(key))
        return SOURCE_CONFIG[key as KnownSource]
    }

    // Generic fallback
    return { name: 'Перейти по ссылке', icon: 'mdi:open-in-new', color: 'var(--fg-secondary-color)' }
  }
  catch {
    console.error('Invalid URL:', props.url)
    return null // Don't render if URL is invalid
  }
})

const isValidUrl = computed(() => {
  if (!props.url)
    return false
  try {
    // eslint-disable-next-line no-new
    new URL(props.url)
    return true
  }
  catch {
    return false
  }
})
</script>

<template>
  <div v-if="url && isValidUrl && sourceInfo" class="source-link-wrapper">
    <label class="field-label">{{ label }}</label>
    <a :href="url" target="_blank" rel="noopener noreferrer" class="source-link">
      <Icon :icon="sourceInfo.icon" class="source-icon" :style="{ color: sourceInfo.color }" />
      <span class="link-text">{{ sourceInfo.name }}</span>
    </a>
  </div>
</template>

<style scoped lang="scss">
.source-link-wrapper {
  grid-column: span 2 / span 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-label {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  font-weight: 500;
  margin-left: 2px;
}

.source-link {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: var(--fg-primary-color);
  font-weight: 500;
  transition: color 0.2s ease;
  width: fit-content;
  min-height: 36px;
  padding: 6px 2px;
  box-sizing: border-box;

  .link-text {
    font-size: 0.9rem;
    text-decoration: underline;
    text-decoration-color: var(--border-secondary-color);
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    transition: all 0.2s ease;
  }

  &:hover {
    color: var(--fg-accent-color);

    .link-text {
      text-decoration-color: var(--fg-accent-color);
    }
  }
}

.source-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .source-link-wrapper {
    grid-column: span 1 / span 1;
  }
}
</style>
