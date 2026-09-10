<script setup lang="ts">
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { Icon } from '@iconify/vue'
import { useMutationObserver } from '@vueuse/core'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js'
import { computed, onMounted, ref } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useCurrencyFormatter } from '../../composables/use-currency-formatter'

interface Props {
  mainCurrency: string
  spendingByCategory: { name: string, icon: string, amount: number }[]
  spendingByDay: { date: string, amount: number }[]
  plannedTotal: number
  spontaneousTotal: number
  filteredTotal: number
}

const props = defineProps<Props>()

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, BarElement, LinearScale)

const { format: formatCurrency } = useCurrencyFormatter()

const currentView = ref<'category' | 'day'>('category')
const hoveredIndex = ref<number | null>(null)

const viewSwitcherItems: ViewSwitcherItem<'category' | 'day'>[] = [
  { id: 'category', label: 'По категориям', icon: 'mdi:chart-pie-outline' },
  { id: 'day', label: 'По дням', icon: 'mdi:chart-bar' },
]

const borderColor = ref('#E0E0E0')
const secondaryTextColor = ref('#6B7280')
const backgroundColor = ref('#FFFFFF')

const CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
]

function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
}

function getCategoryBg(index: number): string {
  const hex = getCategoryColor(index)
  return `${hex}1F`
}

function formatDate(dateString: string, options: Intl.DateTimeFormatOptions) {
  return new Date(dateString).toLocaleDateString('ru-RU', options)
}

function getCategoryWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 19)
    return 'категорий'
  if (mod10 === 1)
    return 'категория'
  if (mod10 >= 2 && mod10 <= 4)
    return 'категории'
  return 'категорий'
}

const categoryTotal = computed(() => {
  return props.spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0)
})

const totalSpend = computed(() => {
  const sum = props.plannedTotal + props.spontaneousTotal
  if (sum > 0)
    return sum
  return props.filteredTotal > 0 ? props.filteredTotal : categoryTotal.value
})

const plannedPercent = computed(() => {
  if (totalSpend.value === 0)
    return 0
  return Math.round((props.plannedTotal / totalSpend.value) * 100)
})

const spontaneousPercent = computed(() => {
  if (totalSpend.value === 0)
    return 0
  return Math.round((props.spontaneousTotal / totalSpend.value) * 100)
})

function getCategoryPercent(amount: number): number {
  const total = categoryTotal.value > 0 ? categoryTotal.value : totalSpend.value
  if (total === 0)
    return 0
  const p = (amount / total) * 100
  return Number(p.toFixed(1))
}

const hoveredCategory = computed(() => {
  if (hoveredIndex.value !== null && props.spendingByCategory[hoveredIndex.value]) {
    return props.spendingByCategory[hoveredIndex.value]
  }
  return null
})

const doughnutChartData = computed(() => {
  const labels = props.spendingByCategory.map(cat => cat.name)
  const data = props.spendingByCategory.map(cat => cat.amount)
  const colors = props.spendingByCategory.map((_, i) => getCategoryColor(i))

  return {
    labels,
    datasets: [
      {
        backgroundColor: colors,
        data,
        borderColor: backgroundColor.value,
        borderWidth: 2,
        hoverBorderColor: backgroundColor.value,
        hoverBorderWidth: 2,
        hoverOffset: 6,
      },
    ],
  }
})

const doughnutChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(25, 20, 25, 0.92)',
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 12 },
      bodyFont: { size: 13, weight: 'bold' as const },
      callbacks: {
        label: (context: any) => {
          const val = context.parsed || 0
          const pct = getCategoryPercent(val)
          return ` ${formatCurrency(val, props.mainCurrency)} (${pct}%)`
        },
      },
    },
  },
  onHover: (_event: any, elements: any[]) => {
    if (elements && elements.length > 0) {
      hoveredIndex.value = elements[0].index
    }
  },
}))

const dailyAverage = computed(() => {
  if (props.spendingByDay.length === 0)
    return 0
  const total = props.spendingByDay.reduce((sum, day) => sum + day.amount, 0)
  return Math.round(total / props.spendingByDay.length)
})

const peakDay = computed(() => {
  if (props.spendingByDay.length === 0)
    return null
  return [...props.spendingByDay].sort((a, b) => b.amount - a.amount)[0]
})

const barChartData = computed(() => {
  const labels = props.spendingByDay.map(day => formatDate(day.date, { day: 'numeric', month: 'short' }))
  const data = props.spendingByDay.map(day => day.amount)

  return {
    labels,
    datasets: [
      {
        label: `Расходы в ${props.mainCurrency}`,
        backgroundColor: '#3B82F6',
        borderRadius: 6,
        data,
      },
    ],
  }
})

const barChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(25, 20, 25, 0.92)',
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => {
          return ` ${formatCurrency(context.parsed.y, props.mainCurrency)}`
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: borderColor.value,
      },
      ticks: {
        color: secondaryTextColor.value,
        callback: (val: any) => formatCurrency(Number(val), props.mainCurrency),
      },
      border: {
        display: false,
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: secondaryTextColor.value,
      },
      border: {
        color: borderColor.value,
      },
    },
  },
}))

function applyThemeStyles() {
  borderColor.value = getComputedStyle(document.documentElement).getPropertyValue('--border-secondary-color').trim() || '#E0E0E0'
  secondaryTextColor.value = getComputedStyle(document.documentElement).getPropertyValue('--fg-secondary-color').trim() || '#6B7280'
  backgroundColor.value = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary-color').trim() || '#FFFFFF'
}

onMounted(() => {
  applyThemeStyles()
})

useMutationObserver(
  document.documentElement,
  () => {
    applyThemeStyles()
  },
  {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme'],
  },
)
</script>

<template>
  <div class="card finances-card">
    <header class="card-header">
      <div class="header-title-group">
        <h4>Расходы</h4>
      </div>
      <KitViewSwitcher
        v-model="currentView"
        :items="viewSwitcherItems"
      />
    </header>

    <div v-if="totalSpend > 0" class="summary-cards">
      <div class="summary-card total">
        <div class="card-top">
          <span class="card-label">Всего расходов</span>
          <Icon icon="mdi:wallet-outline" class="card-icon" />
        </div>
        <div class="card-value">
          {{ formatCurrency(totalSpend, mainCurrency) }}
        </div>
        <div class="card-meta">
          {{ spendingByCategory.length }} {{ getCategoryWord(spendingByCategory.length) }}
        </div>
      </div>

      <div class="summary-card planned">
        <div class="card-top">
          <span class="card-label">Основные</span>
          <Icon icon="mdi:target" class="card-icon" />
        </div>
        <div class="card-value">
          {{ formatCurrency(plannedTotal, mainCurrency) }}
        </div>
        <div class="card-meta">
          <span class="badge planned">{{ plannedPercent }}%</span>
          <span>по плану</span>
        </div>
      </div>

      <div class="summary-card spontaneous" :class="{ 'is-muted': spontaneousTotal === 0 }">
        <div class="card-top">
          <span class="card-label">Дополнительные</span>
          <Icon icon="mdi:sparkles" class="card-icon" />
        </div>
        <div class="card-value">
          {{ formatCurrency(spontaneousTotal, mainCurrency) }}
        </div>
        <div class="card-meta">
          <span v-if="spontaneousTotal > 0" class="badge spontaneous">{{ spontaneousPercent }}%</span>
          <span>{{ spontaneousTotal > 0 ? 'сверх плана' : 'нет спонтанных' }}</span>
        </div>
      </div>
    </div>

    <div v-if="currentView === 'category'">
      <div v-if="spendingByCategory.length > 0" class="categories-content">
        <div class="chart-container" @mouseleave="hoveredIndex = null">
          <Doughnut :data="doughnutChartData" :options="doughnutChartOptions" />
          <div class="chart-center" :class="{ 'is-hovered': hoveredCategory !== null }">
            <span class="center-label">
              {{ hoveredCategory ? hoveredCategory.name : 'Всего' }}
            </span>
            <span class="center-amount">
              {{ formatCurrency(hoveredCategory ? hoveredCategory.amount : (categoryTotal || totalSpend), mainCurrency) }}
            </span>
            <span class="center-meta">
              {{ hoveredCategory ? `${getCategoryPercent(hoveredCategory.amount)}%` : `${spendingByCategory.length} ${getCategoryWord(spendingByCategory.length)}` }}
            </span>
          </div>
        </div>

        <ul class="legend-list">
          <li
            v-for="(cat, index) in spendingByCategory"
            :key="cat.name"
            class="legend-item"
            :class="{ 'is-active': hoveredIndex === index }"
            @mouseenter="hoveredIndex = index"
            @mouseleave="hoveredIndex = null"
          >
            <div class="legend-icon-badge" :style="{ backgroundColor: getCategoryBg(index) }">
              <Icon :icon="cat.icon || 'mdi:tag-outline'" :style="{ color: getCategoryColor(index) }" />
            </div>

            <div class="legend-details">
              <div class="legend-main-row">
                <span class="legend-title" :title="cat.name">{{ cat.name }}</span>
                <div class="legend-values">
                  <span class="legend-percentage">{{ getCategoryPercent(cat.amount) }}%</span>
                  <span class="legend-separator" />
                  <span class="legend-amount">{{ formatCurrency(cat.amount, mainCurrency) }}</span>
                </div>
              </div>
              <div class="legend-progress-track">
                <div
                  class="legend-progress-fill"
                  :style="{
                    width: `${getCategoryPercent(cat.amount)}%`,
                    backgroundColor: getCategoryColor(index),
                  }"
                />
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div v-else class="empty-state">
        <Icon icon="mdi:chart-pie-outline" />
        <p>Здесь появится график, когда вы добавите расходы.</p>
      </div>
    </div>

    <div v-else-if="currentView === 'day'">
      <div v-if="spendingByDay.length > 0" class="days-content">
        <div class="days-stats-grid">
          <div class="days-stat-card">
            <span class="days-stat-label">В среднем в день</span>
            <span class="days-stat-val">{{ formatCurrency(dailyAverage, mainCurrency) }}</span>
          </div>
          <div v-if="peakDay" class="days-stat-card">
            <span class="days-stat-label">Пиковый день</span>
            <span class="days-stat-val">
              {{ formatDate(peakDay.date, { day: 'numeric', month: 'short' }) }}
              <span class="days-stat-sub">({{ formatCurrency(peakDay.amount, mainCurrency) }})</span>
            </span>
          </div>
          <div class="days-stat-card">
            <span class="days-stat-label">Дней с тратами</span>
            <span class="days-stat-val">{{ spendingByDay.length }}</span>
          </div>
        </div>

        <div class="chart-container-bar">
          <Bar :data="barChartData" :options="barChartOptions" />
        </div>
      </div>
      <div v-else class="empty-state">
        <Icon icon="mdi:chart-bar" />
        <p>Здесь появится график, когда вы добавите расходы.</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finances-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;

  h4 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding-bottom: 0.25rem;
}

.summary-card {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &.total {
    border-color: color-mix(in srgb, var(--fg-accent-color) 30%, var(--border-secondary-color));
    background: linear-gradient(
      135deg,
      var(--bg-primary-color) 0%,
      color-mix(in srgb, var(--bg-accent-color, #fce9e4) 25%, var(--bg-primary-color)) 100%
    );

    .card-value {
      color: var(--fg-primary-color);
    }
  }

  &.is-muted {
    opacity: 0.7;

    .card-value {
      color: var(--fg-secondary-color);
    }
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--fg-secondary-color);
    font-size: 0.8rem;
  }

  .card-label {
    font-weight: 500;
  }

  .card-icon {
    font-size: 1.05rem;
    opacity: 0.8;
  }

  .card-value {
    font-size: 1.2rem;
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--fg-tertiary-color);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 0.7rem;

    &.planned {
      background-color: color-mix(in srgb, #3b82f6 15%, transparent);
      color: #2563eb;
    }

    &.spontaneous {
      background-color: color-mix(in srgb, #bd10e0 15%, transparent);
      color: #9333ea;
    }
  }
}

.categories-content {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  min-height: 190px;
}

.chart-container {
  position: relative;
  height: 180px;
  width: 180px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  width: 110px;
  transition: all 0.2s ease-out;

  .center-label {
    font-size: 0.72rem;
    color: var(--fg-secondary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
    line-height: 1.2;
  }

  .center-amount {
    font-size: 0.95rem;
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--fg-primary-color);
    margin: 2px 0;
    line-height: 1.2;
    white-space: nowrap;
  }

  .center-meta {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--fg-accent-color, #e16032);
    line-height: 1.2;
  }

  &.is-hovered {
    transform: translate(-50%, -50%) scale(1.04);

    .center-label {
      color: var(--fg-primary-color);
      font-weight: 600;
    }
  }
}

.legend-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.6rem;
  align-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.55rem;
  border-radius: var(--r-s);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  transition: all 0.15s ease;
  cursor: pointer;

  &:hover,
  &.is-active {
    border-color: color-mix(in srgb, var(--fg-accent-color) 45%, var(--border-secondary-color));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
  }

  .legend-icon-badge {
    width: 24px;
    height: 24px;
    border-radius: calc(var(--r-s) - 2px);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 0.9rem;
    transition: transform 0.15s ease;
  }

  &:hover .legend-icon-badge,
  &.is-active .legend-icon-badge {
    transform: scale(1.1);
  }

  .legend-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .legend-main-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.4rem;
  }

  .legend-title {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .legend-values {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }

  .legend-percentage {
    font-size: 0.68rem;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--fg-secondary-color);
    background-color: var(--bg-tertiary-color);
    padding: 1px 5px;
    border-radius: 4px;
    line-height: 1.2;
    letter-spacing: -0.2px;
    transition: all 0.15s ease;
  }

  .legend-separator {
    width: 1px;
    height: 11px;
    background-color: var(--border-secondary-color);
    flex-shrink: 0;
  }

  .legend-amount {
    font-size: 0.8rem;
    font-weight: 600;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--fg-primary-color);
    white-space: nowrap;
  }

  .legend-progress-track {
    width: 100%;
    height: 3px;
    background-color: var(--border-secondary-color);
    border-radius: 2px;
    overflow: hidden;
  }

  .legend-progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
}

.days-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.days-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.days-stat-card {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 0.6rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  .days-stat-label {
    font-size: 0.75rem;
    color: var(--fg-secondary-color);
  }

  .days-stat-val {
    font-size: 0.95rem;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--fg-primary-color);
  }

  .days-stat-sub {
    font-size: 0.8rem;
    font-weight: normal;
    color: var(--fg-tertiary-color);
    margin-left: 0.25rem;
  }
}

.chart-container-bar {
  position: relative;
  height: 200px;
}

.empty-state {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary-color);
  text-align: center;
  padding: 2rem 1rem;
  min-height: 180px;
  font-size: 2.5rem;

  p {
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
}

@include media-down(md) {
  .summary-cards {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .days-stats-grid {
    grid-template-columns: 1fr;
  }
}

@include media-down(sm) {
  .categories-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1.25rem;
  }

  .legend-list {
    grid-template-columns: 1fr;
  }

  .chart-container {
    align-self: center;
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-cards {
    grid-template-columns: 1fr;
  }
}
</style>
