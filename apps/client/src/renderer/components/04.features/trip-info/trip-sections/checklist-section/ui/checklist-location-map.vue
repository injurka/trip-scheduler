<script setup lang="ts">
import type { MapMarker } from '~/components/01.kit/kit-map'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMap, useKitMapSearch } from '~/components/01.kit/kit-map'

interface Props {
  name: string
  coords?: { lat: number, lon: number }
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  save: [value: { name: string, coords: { lat: number, lon: number } }]
}>()
const { searchLocation, isSearching } = useKitMapSearch()
const selected = ref(props.coords ? { ...props.coords } : undefined)
const query = ref(props.name)
const selectedName = ref(props.name)
const error = ref('')
const center = computed<[number, number]>(() => selected.value ? [selected.value.lon, selected.value.lat] : [0, 20])
const markers = computed<MapMarker[]>(() => selected.value ? [{ id: 'checklist-location', coords: selected.value, title: selectedName.value }] : [])

async function search() {
  if (!query.value.trim() || isSearching.value)
    return

  error.value = ''

  try {
    const result = await searchLocation(query.value)

    if (!result) {
      error.value = 'Место не найдено. Уточните название или выберите точку на карте.'

      return
    }

    selected.value = { lat: result.lat, lon: result.lon }
    selectedName.value = result.displayName.split(',')[0]
  }
  catch {
    error.value = 'Не удалось выполнить поиск. Попробуйте ещё раз.'
  }
}
function select(coords: [number, number]) {
  if (props.readonly)
    return

  selected.value = { lat: coords[1], lon: coords[0] }
}
</script>

<template>
  <KitDialogWithClose
    :visible="true"
    :title="name || 'Локация'"
    :max-width="800"
    @update:visible="!$event && emit('close')"
  >
    <div class="location-map-content">
      <form class="location-search" @submit.prevent="search">
        <KitInput v-model="query" placeholder="Название места или адрес" />
        <KitBtn
          type="submit"
          icon="mdi:magnify"
          :loading="isSearching"
          aria-label="Найти место"
        />
      </form>
      <p v-if="error" role="alert">
        {{ error }}
      </p>
      <p v-if="!selected">
        Найдите место по названию<span v-if="!readonly"> или выберите точку на карте</span>.
      </p>
      <KitMap
        :key="selected ? 'point' : 'world'"
        :center="center"
        :zoom="selected ? 15 : 2"
        :markers="markers"
        height="45vh"
        @click="select"
      />
      <div class="location-map-footer">
        <span v-if="selected">{{ selected.lat.toFixed(6) }}, {{ selected.lon.toFixed(6) }}</span>
        <KitBtn v-if="!readonly" :disabled="!selected || isSearching" @click="selected && emit('save', { name: selectedName, coords: selected })">
          Сохранить точку
        </KitBtn>
        <KitBtn v-else @click="emit('close')">
          Закрыть
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.location-map-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.location-search,
.location-map-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.location-map-footer {
  justify-content: space-between;
}
</style>
