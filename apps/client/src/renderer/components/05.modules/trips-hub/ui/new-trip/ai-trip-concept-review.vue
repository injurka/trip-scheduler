<script setup lang="ts">
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import type {
  AiTripPlaceCategory,
  IAiTripConceptDayOutline,
  IAiTripConceptHotel,
  IAiTripConceptPlace,
  IAiTripConceptProposal,
  IApprovedAiTripConcept,
} from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'

interface Props {
  proposal: IAiTripConceptProposal
  isRefining?: boolean
  refineError?: string | null
}
type ReviewTab = 'places' | 'hotels' | 'days'

const props = withDefaults(defineProps<Props>(), {
  isRefining: false,
  refineError: null,
})
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refine', payload: {
    feedback: string
    excludedPlaceNames: string[]
    customPins: Array<{ type: 'place' | 'hotel', title: string, note?: string }>
  }): void
  (e: 'confirm', approved: IApprovedAiTripConcept): void
}>()

const activeTab = ref<ReviewTab>('places')
const editableTitle = ref('')
const placesList = ref<IAiTripConceptPlace[]>([])
const selectedPlaceIds = ref<Set<string>>(new Set())
const hotelsList = ref<IAiTripConceptHotel[]>([])
const selectedHotelIds = ref<Set<string>>(new Set())
const editableDays = ref<IAiTripConceptDayOutline[]>([])
const cityFilter = ref<string>('all')
const newPlaceName = ref('')
const newPlaceCity = ref('')
const newHotelName = ref('')
const newHotelCity = ref('')
const refinementFeedback = ref('')
// Храним накопленный список отклонённых мест между пересборками
const persistentExcludedNames = ref<Set<string>>(new Set())
const customAddedPlaces = ref<IAiTripConceptPlace[]>([])
const customAddedHotels = ref<IAiTripConceptHotel[]>([])
const categoryMeta: Record<AiTripPlaceCategory, { icon: string, label: string }> = {
  attraction: { icon: 'mdi:camera-outline', label: 'Локация' },
  nature: { icon: 'mdi:pine-tree', label: 'Природа' },
  food: { icon: 'mdi:silverware-fork-knife', label: 'Гастро' },
  culture: { icon: 'mdi:bank-outline', label: 'Культура' },
  relax: { icon: 'mdi:spa-outline', label: 'Отдых' },
}
const tierLabels: Record<string, string> = {
  budget: 'Бюджет',
  comfort: 'Комфорт',
  boutique: 'Бутик',
}

const selectedPlacesCount = computed(() => selectedPlaceIds.value.size)
const selectedHotelsCount = computed(() => selectedHotelIds.value.size)
const tabItems = computed<ViewSwitcherItem<ReviewTab>[]>(() => [
  {
    id: 'places',
    label: `Места (${selectedPlacesCount.value}/${placesList.value.length})`,
    icon: 'mdi:map-marker-check-outline',
  },
  {
    id: 'hotels',
    label: `Отели (${selectedHotelsCount.value})`,
    icon: 'mdi:bed-outline',
  },
  {
    id: 'days',
    label: `По дням (${editableDays.value.length})`,
    icon: 'mdi:calendar-text-outline',
  },
])
const availableCities = computed(() => {
  const set = new Set<string>()

  for (const c of props.proposal.cities) {
    if (c.name)
      set.add(c.name)
  }

  for (const p of placesList.value) {
    if (p.city)
      set.add(p.city)
  }

  return [...set]
})
const visiblePlaces = computed(() => {
  if (cityFilter.value === 'all')
    return placesList.value

  return placesList.value.filter(p => p.city === cityFilter.value)
})
const formattedBudget = computed(() => {
  if (!props.proposal.estimatedBudgetRub || props.proposal.estimatedBudgetRub <= 0)
    return null

  return `~${new Intl.NumberFormat('ru-RU').format(Math.round(props.proposal.estimatedBudgetRub))} ₽`
})

watch(() => props.proposal, (nextProposal) => {
  syncFromProposal(nextProposal)
}, { immediate: true })

function syncPlacesFromProposal(places: IAiTripConceptPlace[]) {
  const mergedPlaces: IAiTripConceptPlace[] = [...customAddedPlaces.value]

  for (const p of places) {
    const exists = mergedPlaces.some(mp => mp.name.trim().toLowerCase() === p.name.trim().toLowerCase())

    if (!exists)
      mergedPlaces.push({ ...p })
  }

  placesList.value = mergedPlaces

  const nextSelectedPlaces = new Set<string>()

  for (const p of mergedPlaces) {
    if (!persistentExcludedNames.value.has(p.name.trim().toLowerCase()))
      nextSelectedPlaces.add(p.id)
  }

  selectedPlaceIds.value = nextSelectedPlaces
}
function syncHotelsFromProposal(hotels: IAiTripConceptHotel[]) {
  const mergedHotels: IAiTripConceptHotel[] = [...customAddedHotels.value]

  for (const h of hotels) {
    const exists = mergedHotels.some(mh => mh.name.trim().toLowerCase() === h.name.trim().toLowerCase())

    if (!exists)
      mergedHotels.push({ ...h })
  }

  hotelsList.value = mergedHotels

  const nextSelectedHotels = new Set<string>()
  const coveredCities = new Set<string>()

  for (const h of mergedHotels) {
    if (!h.isUserPinned)
      continue

    nextSelectedHotels.add(h.id)

    if (h.city)
      coveredCities.add(h.city.toLowerCase())
  }

  for (const h of mergedHotels) {
    const cityKey = (h.city || '').toLowerCase()

    if (!coveredCities.has(cityKey)) {
      coveredCities.add(cityKey)
      nextSelectedHotels.add(h.id)
    }
  }

  selectedHotelIds.value = nextSelectedHotels
}
function syncFromProposal(proposal: IAiTripConceptProposal) {
  editableTitle.value = proposal.title
  syncPlacesFromProposal(proposal.places)
  syncHotelsFromProposal(proposal.hotels)
  editableDays.value = proposal.daysOutline.map(d => ({
    dayNumber: d.dayNumber,
    city: d.city,
    title: d.title,
    highlights: [...d.highlights],
  }))
  cityFilter.value = 'all'
}
function isPlaceSelected(id: string): boolean {
  return selectedPlaceIds.value.has(id)
}
function togglePlace(place: IAiTripConceptPlace) {
  const next = new Set(selectedPlaceIds.value)
  const nameKey = place.name.trim().toLowerCase()

  if (next.has(place.id)) {
    next.delete(place.id)
    persistentExcludedNames.value.add(nameKey)
  }
  else {
    next.add(place.id)
    persistentExcludedNames.value.delete(nameKey)
  }

  selectedPlaceIds.value = next
}
function selectAllPlaces() {
  const next = new Set<string>()

  for (const p of placesList.value) {
    next.add(p.id)
    persistentExcludedNames.value.delete(p.name.trim().toLowerCase())
  }

  selectedPlaceIds.value = next
}
function addCustomPlace() {
  const name = newPlaceName.value.trim()

  if (!name)
    return

  const city = newPlaceCity.value.trim()
    || (cityFilter.value !== 'all' ? cityFilter.value : (props.proposal.cities[0]?.name || ''))

  const item: IAiTripConceptPlace = {
    id: `user-place-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    city,
    category: 'attraction',
    whyVisit: 'Добавлено вами вручную',
    isUserPinned: true,
  }

  customAddedPlaces.value.unshift(item)
  placesList.value = [item, ...placesList.value]

  const next = new Set(selectedPlaceIds.value)
  next.add(item.id)
  selectedPlaceIds.value = next
  persistentExcludedNames.value.delete(name.toLowerCase())

  newPlaceName.value = ''
  newPlaceCity.value = ''
}
function isHotelSelected(id: string): boolean {
  return selectedHotelIds.value.has(id)
}
function toggleHotel(hotel: IAiTripConceptHotel) {
  const next = new Set(selectedHotelIds.value)

  if (next.has(hotel.id))
    next.delete(hotel.id)
  else
    next.add(hotel.id)

  selectedHotelIds.value = next
}
function addCustomHotel() {
  const name = newHotelName.value.trim()

  if (!name)
    return

  const city = newHotelCity.value.trim() || props.proposal.cities[0]?.name || ''
  const item: IAiTripConceptHotel = {
    id: `user-hotel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    city,
    area: '',
    pricePerNightRub: 0,
    tier: 'comfort',
    whyStay: 'Ваш вариант размещения',
    isUserPinned: true,
  }

  customAddedHotels.value.unshift(item)
  hotelsList.value = [item, ...hotelsList.value]

  const next = new Set(selectedHotelIds.value)
  next.add(item.id)
  selectedHotelIds.value = next

  newHotelName.value = ''
  newHotelCity.value = ''
}
function formatPriceRub(price: number): string {
  if (!price || price <= 0)
    return 'по запросу'

  return `~${new Intl.NumberFormat('ru-RU').format(Math.round(price))} ₽/ночь`
}
function handleRefine() {
  const feedback = refinementFeedback.value.trim()

  if (!feedback || props.isRefining)
    return

  const excludedPlaceNames = [
    ...new Set([
      ...persistentExcludedNames.value,
      ...placesList.value
        .filter(p => !selectedPlaceIds.value.has(p.id))
        .map(p => p.name.trim()),
    ]),
  ].filter(Boolean)

  const customPins: Array<{ type: 'place' | 'hotel', title: string, note?: string }> = [
    ...customAddedPlaces.value
      .filter(p => selectedPlaceIds.value.has(p.id))
      .map(p => ({ type: 'place' as const, title: p.name, note: p.city || undefined })),
    ...customAddedHotels.value
      .filter(h => selectedHotelIds.value.has(h.id))
      .map(h => ({ type: 'hotel' as const, title: h.name, note: h.city || undefined })),
  ]

  emit('refine', {
    feedback,
    excludedPlaceNames,
    customPins,
  })
  refinementFeedback.value = ''
}
function handleConfirm() {
  const selectedPlaces = placesList.value
    .filter(p => selectedPlaceIds.value.has(p.id))
    .map(p => ({
      name: p.name,
      city: p.city,
      category: p.category,
      whyVisit: p.whyVisit,
    }))

  const excludedPlaces = placesList.value
    .filter(p => !selectedPlaceIds.value.has(p.id))
    .map(p => p.name)

  const selectedHotels = hotelsList.value
    .filter(h => selectedHotelIds.value.has(h.id))
    .map(h => ({
      name: h.name,
      city: h.city,
      area: h.area || undefined,
      pricePerNightRub: h.pricePerNightRub > 0 ? h.pricePerNightRub : undefined,
      whyStay: h.whyStay || undefined,
    }))

  emit('confirm', {
    title: editableTitle.value.trim() || props.proposal.title,
    summary: props.proposal.summary,
    estimatedBudgetRub: props.proposal.estimatedBudgetRub,
    cities: props.proposal.cities,
    selectedPlaces,
    excludedPlaces,
    selectedHotels,
    daysOutline: editableDays.value,
  })
}
</script>

<template>
  <div class="concept-review">
    <!-- Шапка концепции -->
    <div class="concept-header-card">
      <div class="concept-title-row">
        <KitInput
          v-model="editableTitle"
          size="sm"
          icon="mdi:compass-rose"
          placeholder="Название путешествия"
        />
      </div>

      <p class="concept-summary">
        {{ proposal.summary }}
      </p>

      <div class="concept-meta-row">
        <div class="cities-chain">
          <template v-for="(city, idx) in proposal.cities" :key="`${city.name}-${idx}`">
            <span class="city-badge">
              <Icon icon="mdi:map-marker-outline" class="city-badge-icon" />
              {{ city.name }}
              <small v-if="city.nights > 0">· {{ city.nights }} н.</small>
            </span>
            <Icon
              v-if="idx < proposal.cities.length - 1"
              icon="mdi:arrow-right"
              class="city-arrow"
            />
          </template>
        </div>

        <span v-if="formattedBudget" class="budget-badge" title="Ориентировочный бюджет на 1 человека">
          <Icon icon="mdi:cash-multiple" />
          {{ formattedBudget }}
        </span>
      </div>
    </div>

    <!-- Переключатель разделов отбора -->
    <KitViewSwitcher
      v-model="activeTab"
      :items="tabItems"
      full-width
    />

    <!-- Вкладка 1: Места и локации -->
    <div v-if="activeTab === 'places'" class="tab-panel">
      <div class="panel-toolbar">
        <div v-if="availableCities.length > 1" class="city-filters">
          <button
            type="button"
            class="filter-chip"
            :class="{ active: cityFilter === 'all' }"
            @click="cityFilter = 'all'"
          >
            Все
          </button>
          <button
            v-for="city in availableCities"
            :key="city"
            type="button"
            class="filter-chip"
            :class="{ active: cityFilter === city }"
            @click="cityFilter = city"
          >
            {{ city }}
          </button>
        </div>
        <span v-else class="toolbar-hint">
          Нажмите на карточку, чтобы исключить ненужное место из маршрута
        </span>

        <button
          v-if="selectedPlacesCount < placesList.length"
          type="button"
          class="text-action-btn"
          @click="selectAllPlaces"
        >
          Вернуть все
        </button>
      </div>

      <div class="cards-scroll-area">
        <button
          v-for="place in visiblePlaces"
          :key="place.id"
          type="button"
          class="selectable-card"
          :class="{
            'is-selected': isPlaceSelected(place.id),
            'is-excluded': !isPlaceSelected(place.id),
          }"
          @click="togglePlace(place)"
        >
          <div class="card-status-indicator">
            <Icon
              :icon="isPlaceSelected(place.id) ? 'mdi:check-circle' : 'mdi:close-circle-outline'"
            />
          </div>

          <div class="card-body">
            <div class="card-top-line">
              <span class="card-title">{{ place.name }}</span>
              <span v-if="place.isUserPinned" class="tag-pill is-pinned">Своё</span>
              <span v-if="!isPlaceSelected(place.id)" class="tag-pill is-excluded">Исключено</span>
              <span v-else class="tag-pill">
                <Icon :icon="categoryMeta[place.category]?.icon || 'mdi:map-marker-outline'" />
                {{ place.city || categoryMeta[place.category]?.label }}
              </span>
            </div>
            <p v-if="place.whyVisit" class="card-subtitle">
              {{ place.whyVisit }}
            </p>
          </div>
        </button>
      </div>

      <div class="quick-add-row">
        <KitInput
          v-model="newPlaceName"
          size="sm"
          icon="mdi:plus-circle-outline"
          placeholder="Добавить своё место, музей или ресторан…"
          class="quick-add-main"
          @keydown.enter.prevent="addCustomPlace"
        />
        <KitInput
          v-if="availableCities.length > 1"
          v-model="newPlaceCity"
          size="sm"
          placeholder="Город"
          class="quick-add-city"
          @keydown.enter.prevent="addCustomPlace"
        />
        <KitBtn
          variant="tonal"
          size="sm"
          icon="mdi:plus"
          :disabled="!newPlaceName.trim()"
          @click="addCustomPlace"
        >
          Добавить
        </KitBtn>
      </div>
    </div>

    <!-- Вкладка 2: Отели -->
    <div v-else-if="activeTab === 'hotels'" class="tab-panel">
      <p class="toolbar-hint">
        Отметьте отели, на которые ориентироваться в расписании и смете, или добавьте свой вариант:
      </p>

      <div class="cards-scroll-area">
        <button
          v-for="hotel in hotelsList"
          :key="hotel.id"
          type="button"
          class="selectable-card"
          :class="{ 'is-selected': isHotelSelected(hotel.id) }"
          @click="toggleHotel(hotel)"
        >
          <div class="card-status-indicator">
            <Icon
              :icon="isHotelSelected(hotel.id) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'"
            />
          </div>

          <div class="card-body">
            <div class="card-top-line">
              <span class="card-title">{{ hotel.name }}</span>
              <span v-if="hotel.isUserPinned" class="tag-pill is-pinned">Свой</span>
              <span v-else class="tag-pill">{{ tierLabels[hotel.tier] || 'Отель' }}</span>
              <span class="price-pill">{{ formatPriceRub(hotel.pricePerNightRub) }}</span>
            </div>
            <p class="card-subtitle">
              <strong>{{ hotel.city }}</strong><template v-if="hotel.area">
                · {{ hotel.area }}
              </template>
              <template v-if="hotel.whyStay">
                — {{ hotel.whyStay }}
              </template>
            </p>
          </div>
        </button>
      </div>

      <div class="quick-add-row">
        <KitInput
          v-model="newHotelName"
          size="sm"
          icon="mdi:bed-outline"
          placeholder="Уже выбрали отель? Впишите название…"
          class="quick-add-main"
          @keydown.enter.prevent="addCustomHotel"
        />
        <KitInput
          v-model="newHotelCity"
          size="sm"
          placeholder="Город / район"
          class="quick-add-city"
          @keydown.enter.prevent="addCustomHotel"
        />
        <KitBtn
          variant="tonal"
          size="sm"
          icon="mdi:plus"
          :disabled="!newHotelName.trim()"
          @click="addCustomHotel"
        >
          Добавить
        </KitBtn>
      </div>
    </div>

    <!-- Вкладка 3: План по дням -->
    <div v-else class="tab-panel">
      <p class="toolbar-hint">
        Краткая разбивка по дням (при желании вы можете подправить тему любого дня):
      </p>

      <div class="cards-scroll-area days-outline-list">
        <div
          v-for="day in editableDays"
          :key="day.dayNumber"
          class="day-outline-card"
        >
          <div class="day-outline-header">
            <span class="day-num-badge">День {{ day.dayNumber }}</span>
            <span class="day-city-badge">
              <Icon icon="mdi:map-marker-outline" />
              {{ day.city }}
            </span>
          </div>

          <KitInput
            v-model="day.title"
            size="sm"
            placeholder="Тема дня"
          />

          <div v-if="day.highlights.length > 0" class="day-highlights">
            <span
              v-for="(hl, idx) in day.highlights"
              :key="idx"
              class="highlight-chip"
            >
              {{ hl }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Панель пересборки с комментарием ИИ -->
    <div class="refine-box">
      <div class="refine-row">
        <KitInput
          v-model="refinementFeedback"
          size="sm"
          icon="mdi:auto-fix"
          :disabled="isRefining"
          placeholder="Хотите изменить маршрут? Напишите ИИ (например: меньше музеев, добавь день на море)…"
          class="refine-input"
          @keydown.enter.prevent="handleRefine"
        />
        <KitBtn
          variant="tonal"
          color="primary"
          size="sm"
          :icon="isRefining ? 'mdi:loading' : 'mdi:refresh'"
          :disabled="!refinementFeedback.trim() || isRefining"
          :class="{ 'is-spinning-icon': isRefining }"
          @click="handleRefine"
        >
          {{ isRefining ? 'Обновляем…' : 'Пересобрать' }}
        </KitBtn>
      </div>
      <p v-if="refineError" class="refine-error">
        {{ refineError }}
      </p>
    </div>

    <!-- Действия -->
    <div class="review-actions">
      <KitBtn
        variant="outlined"
        color="secondary"
        icon="mdi:arrow-left"
        :disabled="isRefining"
        @click="emit('back')"
      >
        Параметры
      </KitBtn>

      <KitBtn
        variant="solid"
        color="primary"
        icon="mdi:check-decagram"
        :disabled="isRefining || selectedPlacesCount === 0"
        @click="handleConfirm"
      >
        Утвердить и создать путешествие
      </KitBtn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.concept-review {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.concept-header-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}

.concept-summary {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--fg-secondary-color);
}

.concept-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.cities-chain {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.city-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--r-full);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-primary-color);

  &-icon {
    color: var(--fg-accent-color);
    font-size: 0.875rem;
  }

  small {
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.city-arrow {
  font-size: 0.875rem;
  color: var(--fg-tertiary-color);
}

.budget-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: var(--r-full);
  background-color: var(--bg-accent-overlay-color);
  color: var(--fg-accent-color);
  font-size: 0.75rem;
  font-weight: 600;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
}

.city-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chip {
  padding: 3px 10px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  @include hover {
    border-color: var(--border-focus-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: var(--bg-accent-overlay-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    font-weight: 600;
  }
}

.text-action-btn {
  background: none;
  border: none;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  cursor: pointer;

  @include hover {
    text-decoration: underline;
  }
}

.cards-scroll-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 4px;
}

.selectable-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;

  @include hover {
    border-color: var(--border-focus-color);
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    background-color: var(--bg-primary-color);

    .card-status-indicator {
      color: var(--fg-accent-color);
    }
  }

  &.is-excluded {
    opacity: 0.6;
    background-color: var(--bg-secondary-color);

    .card-title {
      text-decoration: line-through;
      color: var(--fg-tertiary-color);
    }

    .card-status-indicator {
      color: var(--fg-error-color);
    }
  }
}

.card-status-indicator {
  font-size: 1.2rem;
  color: var(--fg-tertiary-color);
  flex-shrink: 0;
  margin-top: 1px;
  display: flex;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.card-top-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.card-subtitle {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--fg-secondary-color);
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: var(--r-full);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--fg-secondary-color);

  &.is-pinned {
    background-color: var(--bg-accent-overlay-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    font-weight: 600;
  }

  &.is-excluded {
    background-color: var(--bg-error-color);
    border-color: var(--border-error-color);
    color: var(--fg-error-color);
  }
}

.price-pill {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-accent-color);
}

.quick-add-row {
  display: flex;
  align-items: center;
  gap: 8px;

  @include media-down(sm) {
    flex-wrap: wrap;
  }

  .quick-add-main {
    flex: 1.6;
    min-width: 160px;
  }

  .quick-add-city {
    flex: 0.9;
    min-width: 110px;
  }
}

.days-outline-list {
  gap: 10px;
}

.day-outline-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
}

.day-outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.day-num-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--fg-accent-color);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.day-city-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.day-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.highlight-chip {
  padding: 2px 8px;
  border-radius: var(--r-2xs);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.72rem;
  color: var(--fg-secondary-color);
}

.refine-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-primary-color);
}

.refine-row {
  display: flex;
  align-items: center;
  gap: 8px;

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }

  .refine-input {
    flex: 1;
  }
}

.refine-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--fg-error-color);
}

.is-spinning-icon {
  :deep(.kit-btn-icon) {
    animation: review-spin 1s linear infinite;
  }
}

.review-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}

@keyframes review-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
