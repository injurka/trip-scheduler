<script setup lang="ts">
import type { MetroSystemDetails } from '~/components/03.domain/metro'
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { metroService } from '~/shared/services/database/metro.service'

const MetroMap = defineAsyncComponent(() => import('~/components/03.domain/metro/ui/metro-map.vue'))
const query = ref('')
const expanded = ref(false)
const systems = ref<{ id: string, city: string }[]>([])
const loading = ref(true)
const error = ref('')
const openingId = ref<string | null>(null)
const activeSystem = ref<MetroSystemDetails | null>(null)
const normalize = (value: string) => value.toLowerCase().replaceAll('ё', 'е').replaceAll('-', ' ')
const maps = computed(() => systems.value.filter(map => normalize(map.city).includes(normalize(query.value.trim()))))
const visibleMaps = computed(() => expanded.value || query.value.trim() ? maps.value : maps.value.slice(0, 6))
async function loadSystems() {
  loading.value = true
  error.value = ''

  try {
    systems.value = await metroService.listSystems()
  }
  catch {
    error.value = 'Не удалось загрузить города. Попробуйте ещё раз.'
  }
  finally {
    loading.value = false
  }
}
async function openMap(id: string) {
  if (openingId.value)
    return

  openingId.value = id
  error.value = ''

  try {
    const details = await metroService.getDetails(id)

    if (!details)
      throw new Error('Missing metro system')

    activeSystem.value = details
  }
  catch {
    error.value = 'Не удалось открыть карту. Попробуйте ещё раз.'
  }
  finally {
    openingId.value = null
  }
}
onMounted(loadSystems)
</script>

<template>
  <section class="metro" aria-labelledby="metro-title">
    <div class="metro-header">
      <div class="metro-intro">
        <div class="metro-symbol" aria-hidden="true">
          <Icon icon="mdi:subway-variant" />
        </div>
        <div>
          <h2 id="metro-title">
            Метро по городам
          </h2>
          <p>Ваш каталог <span aria-hidden="true">·</span> Линии, станции и пересадки</p>
        </div>
      </div>
      <div class="metro-search">
        <KitInput
          v-model="query"
          size="sm"
          icon="mdi:magnify"
          placeholder="Найти город…"
          aria-label="Поиск города на карте метро"
        />
      </div>
    </div>

    <p v-if="loading" role="status">
      Загружаем города…
    </p>
    <ul v-else-if="maps.length" class="metro-cities">
      <li v-for="map in visibleMaps" :key="map.id">
        <button
          type="button"
          :class="{ selected: activeSystem?.id === map.id }"
          :aria-pressed="activeSystem?.id === map.id"
          :disabled="openingId !== null"
          :aria-busy="openingId === map.id"
          :aria-label="`${map.city}: открыть карту метро`"
          @click="openMap(map.id)"
        >
          <span class="station" aria-hidden="true" />
          <span class="city-label">
            <strong>{{ map.city }}</strong>
            <span>{{ openingId === map.id ? 'Загружаем…' : activeSystem?.id === map.id ? 'Карта показана ниже' : 'Открыть карту' }}</span>
          </span>
          <Icon icon="mdi:arrow-right" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <div v-else-if="!error" class="metro-empty" role="status">
      <Icon icon="mdi:map-search-outline" aria-hidden="true" />
      <p>{{ query.trim() ? 'Город не найден. Попробуйте другое название.' : 'В вашем каталоге пока нет городов метро.' }}</p>
      <KitBtn
        v-if="query.trim()"
        size="sm"
        variant="text"
        @click="query = ''"
      >
        Сбросить поиск
      </KitBtn>
    </div>

    <div v-if="error" class="metro-empty" role="alert">
      <p>{{ error }}</p>
      <KitBtn
        v-if="!systems.length"
        size="sm"
        variant="text"
        @click="loadSystems"
      >
        Повторить
      </KitBtn>
    </div>
    <div class="metro-footer">
      <span>Интерактивные карты из вашего каталога</span>
      <KitBtn
        v-if="maps.length > 6 && !query.trim()"
        size="sm"
        variant="text"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Свернуть' : `Все города · ${maps.length}` }}
        <Icon :icon="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
      </KitBtn>
    </div>
    <section
      v-if="activeSystem"
      class="inline-map"
      aria-labelledby="active-metro-title"
      :aria-busy="openingId !== null"
    >
      <h3 id="active-metro-title">
        Метро · {{ activeSystem.city }}
      </h3>
      <MetroMap :system="activeSystem" :rides="[]" />
    </section>
  </section>
</template>

<style scoped lang="scss">
.metro {
  padding: 1.25rem;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  background: linear-gradient(120deg, rgba(var(--bg-accent-overlay-color-rgb), 0.12), var(--bg-secondary-color) 65%);
}
.inline-map {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-secondary-color);

  h3 {
    margin: 0 0 0.75rem;
    color: var(--fg-primary-color);
    font-size: 1.05rem;
  }
}
.metro-header,
.metro-intro,
.metro-footer {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.metro-header,
.metro-footer {
  justify-content: space-between;
}
.metro-intro {
  min-width: 0;
}
.metro-symbol {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--r-m);
  background: rgba(var(--bg-accent-overlay-color-rgb), 0.25);
  color: var(--fg-accent-color);
  font-size: 1.6rem;
}
h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--fg-primary-color);
}
p {
  margin: 0.3rem 0 0;
  color: var(--fg-secondary-color);
  font-size: 0.825rem;
  line-height: 1.5;
}
.metro-search {
  width: 240px;
  flex-shrink: 0;
}
.metro-cities {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  button {
    width: 100%;
    text-align: left;
    font: inherit;
    cursor: pointer;
    &:disabled {
      cursor: progress;
      opacity: 0.65;
    }
    display: flex;
    align-items: center;
    gap: 0.75rem;
    height: 100%;
    padding: 0.8rem;
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    background: var(--bg-primary-color);
    color: var(--fg-secondary-color);
    text-decoration: none;
    transition:
      border-color 0.2s,
      background-color 0.2s;
    &:hover {
      border-color: var(--border-accent-color);
      background: var(--bg-hover-color);
    }
    &.selected {
      border-color: var(--border-accent-color);
      background: rgba(var(--bg-accent-overlay-color-rgb), 0.15);
    }
    &:focus-visible {
      outline: 2px solid var(--fg-accent-color);
      outline-offset: 3px;
    }
    > .iconify {
      margin-left: auto;
      flex-shrink: 0;
      color: var(--fg-accent-color);
    }
  }
}
.station {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border: 3px solid var(--fg-accent-color);
  border-radius: 50%;
}
.city-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.2rem;
  strong {
    font-size: 0.9rem;
    color: var(--fg-primary-color);
    overflow-wrap: anywhere;
  }
  > span {
    font-size: 0.7rem;
    color: var(--fg-tertiary-color);
  }
}
.metro-footer {
  min-height: 30px;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  flex-wrap: wrap;
}
.metro-empty {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 1.25rem 0;
  color: var(--fg-secondary-color);
  p {
    margin: 0;
  }
}
@include media-down(md) {
  .metro-header {
    flex-wrap: wrap;
  }
  .metro-search {
    width: 100%;
  }
  .metro-cities {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@include media-down(sm) {
  .metro {
    padding: 1rem;
  }
  .metro-cities {
    grid-template-columns: 1fr;
  }
}
</style>
