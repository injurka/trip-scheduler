<script setup lang="ts">
import type { NoteProperty } from '../../lib/note-frontmatter'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { formatDate } from '~/shared/lib/date-time'
import { resolveApiUrl } from '~/shared/lib/url'
import { describeDateRange, isRemoteImageReference } from '../../lib/note-frontmatter'

interface Props {
  properties: NoteProperty[]
}

const props = defineProps<Props>()

const isCollapsed = ref(false)
const failedImages = ref<string[]>([])

const dateRange = computed(() => describeDateRange(props.properties))

function displayValue(property: NoteProperty): string {
  if (property.date)
    return formatDate(property.date, { day: 'numeric', month: 'long', year: 'numeric' })

  return property.text
}

function isImageVisible(property: NoteProperty): boolean {
  return property.display === 'image'
    && isRemoteImageReference(property.text)
    && !failedImages.value.includes(property.key)
}

function markImageFailed(key: string): void {
  failedImages.value.push(key)
}
</script>

<template>
  <section class="note-properties">
    <button type="button" class="note-properties-header" @click="isCollapsed = !isCollapsed">
      <Icon icon="mdi:tag-multiple-outline" class="note-properties-icon" />
      <span class="note-properties-title">Свойства</span>
      <Icon :icon="isCollapsed ? 'mdi:chevron-down' : 'mdi:chevron-up'" class="note-properties-chevron" />
    </button>

    <dl v-if="!isCollapsed" class="note-properties-list">
      <template v-for="property in properties" :key="property.key">
        <dt class="note-property-label">
          {{ property.label }}
        </dt>
        <dd class="note-property-value">
          <img
            v-if="isImageVisible(property)"
            :src="resolveApiUrl(property.text)"
            :alt="property.label"
            class="note-property-image"
            @error="markImageFailed(property.key)"
          >

          <span v-else-if="property.display === 'chips'" class="note-property-chips">
            <span v-for="item in property.items" :key="item" class="note-property-chip">{{ item }}</span>
          </span>

          <span v-else-if="property.display === 'flag'" class="note-property-flag" :class="{ 'is-on': property.flag }">
            <Icon :icon="property.flag ? 'mdi:check-circle-outline' : 'mdi:circle-outline'" />
            {{ property.flag ? 'Да' : 'Нет' }}
          </span>

          <span v-else-if="property.display === 'code'" class="note-property-code">{{ property.text }}</span>

          <span v-else-if="property.display === 'file'" class="note-property-file" :title="property.hint ?? property.text">{{ property.text }}</span>

          <span v-else class="note-property-text">{{ displayValue(property) }}</span>
        </dd>
      </template>

      <template v-if="dateRange">
        <dt class="note-property-label">
          Длительность
        </dt>
        <dd class="note-property-value">
          <span class="note-property-text">{{ dateRange }}</span>
        </dd>
      </template>
    </dl>
  </section>
</template>

<style scoped lang="scss">
.note-properties {
  margin-bottom: 20px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  overflow: hidden;
}

.note-properties-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--fg-tertiary-color);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &:hover {
    color: var(--fg-secondary-color);
  }
}

.note-properties-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.note-properties-title {
  flex: 1;
  min-width: 0;
}

.note-properties-chevron {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.note-properties-list {
  display: grid;
  grid-template-columns: minmax(96px, max-content) minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 16px;
  margin: 0;
  padding: 0 12px 12px;

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}

.note-property-label {
  color: var(--fg-tertiary-color);
  font-size: 0.8125rem;
  line-height: 1.5;

  @media (max-width: 768px) {
    margin-top: 6px;
  }
}

.note-property-value {
  margin: 0;
  min-width: 0;
  color: var(--fg-primary-color);
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.note-property-text {
  white-space: pre-line;
}

.note-property-code {
  display: block;
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
  white-space: pre-wrap;
}

.note-property-file {
  font-family: var(--font-mono, monospace);
  font-size: 0.8125rem;
  color: var(--fg-secondary-color);
}

.note-property-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.note-property-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid var(--border-primary-color);
  border-radius: 999px;
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  line-height: 1.5;
}

.note-property-flag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--fg-tertiary-color);
  font-size: 0.8125rem;

  &.is-on {
    color: var(--fg-success-color);
  }

  .iconify {
    font-size: 1rem;
  }
}

.note-property-image {
  display: block;
  max-width: 100%;
  max-height: 220px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  object-fit: cover;
  background: var(--bg-tertiary-color);
}
</style>
