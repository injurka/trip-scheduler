<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'
import { resolveApiUrl } from '~/shared/lib/url'

interface Props {
  name?: string | null
  src?: string | null
  size?: number | string
  isMore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  src: undefined,
  size: 32,
  isMore: false,
})

const resolvedSrc = computed(() => resolveApiUrl(props.src))

/**
 * Вычисляет инициалы из полного имени.
 * @example 'Иван Петров' -> 'ИП'
 */
const initials = computed(() => {
  if (props.isMore || !props.name)
    return ''
  return props.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

/**
 * Определяет цветовой класс для аватара на основе имени,
 * чтобы цвета участников были разными, но постоянными.
 */
const colorClass = computed(() => {
  if (props.isMore)
    return 'avatar--more'
  if (!props.name)
    return ''

  const avatarColorNames = ['blue', 'orange', 'green', 'red', 'purple', 'cyan']
  const index = props.name.length % avatarColorNames.length
  return `avatar--${avatarColorNames[index]}`
})

/**
 * Генерирует инлайновые стили для управления размером аватара.
 */
const sizeStyle = computed(() => {
  const sizeValue = typeof props.size === 'number' ? `${props.size}px` : props.size
  if (!sizeValue)
    return {}

  const fontSize = `calc(${sizeValue} / 2.5)`

  return {
    width: sizeValue,
    height: sizeValue,
    fontSize,
  }
})
</script>

<template>
  <AvatarRoot class="kit-avatar" :class="[colorClass]" :style="sizeStyle">
    <AvatarImage
      v-if="resolvedSrc"
      class="kit-avatar-image"
      :src="resolvedSrc"
      :alt="name"
    />
    <AvatarFallback class="kit-avatar-fallback" :delay-ms="300">
      <slot>
        {{ initials }}
      </slot>
    </AvatarFallback>
  </AvatarRoot>
</template>

<style lang="scss">
@use '~/assets/scss/mixins/_avatar.scss' as mixins-avatar;

.kit-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  overflow: hidden;
  user-select: none;
  border-radius: var(--r-full);
  font-weight: 600;
  border: 2px solid var(--bg-primary-color);
  box-sizing: border-box;

  @each $name, $color in mixins-avatar.$avatar-base-colors {
    &.avatar--#{$name} {
      @include mixins-avatar.generate-avatar-colors($color);
    }
  }

  &.avatar--more {
    color: var(--fg-secondary-color);
    background-color: var(--bg-tertiary-color);
  }
}

.kit-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.kit-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  background-color: inherit;
  line-height: 1;
}
</style>
