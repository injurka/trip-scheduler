<script setup lang="ts">
import type { ViewSwitcherItem } from '~/components/01.kit/kit-view-switcher'
import { Icon } from '@iconify/vue'
import { useMutationObserver } from '@vueuse/core'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useCurrencyFormatter } from '../../composables/use-currency-formatter'

interface CategorySpendingItem {
  id?: string
  name: string
  icon: string
  amount: number
  paidAmount?: number
  plannedAmount?: number
  budgetLimit?: number
  colorIndex?: number
}

interface Props {
  mainCurrency: string
  spendingByCategory: CategorySpendingItem[]
  spendingByDay: { date: string, amount: number }[]
  overallBudget?: number
  paidTotal?: number
  plannedTotal: number
  spontaneousTotal: number
  filteredTotal: number
  statusFilter?: 'all' | 'paid' | 'planned'
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
  const safeIndex = Math.max(0, Math.abs(index || 0)) % CATEGORY_COLORS.length
  return CATEGORY_COLORS[safeIndex]
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

const hasBudget = computed(() => {
  return (props.overallBudget && props.overallBudget > 0)
    || props.spendingByCategory.some(c => (c.budgetLimit && c.budgetLimit > 0))
    || (props.plannedTotal > 0 && props.paidTotal !== undefined)
})

const effectivePaidTotal = computed(() => {
  return props.paidTotal !== undefined ? props.paidTotal : props.filteredTotal
})

const effectivePlannedTotal = computed(() => {
  return props.plannedTotal
})

const effectiveOverallBudget = computed(() => {
  if (props.overallBudget && props.overallBudget > 0)
    return props.overallBudget
  return effectivePaidTotal.value + effectivePlannedTotal.value
})

const remainingBudget = computed(() => {
  return Math.max(0, effectiveOverallBudget.value - effectivePaidTotal.value)
})

const freeBudget = computed(() => {
  return Math.max(0, effectiveOverallBudget.value - effectivePaidTotal.value - effectivePlannedTotal.value)
})

const paidPercentOfBudget = computed(() => {
  if (effectiveOverallBudget.value === 0)
    return 0
  return Math.round((effectivePaidTotal.value / effectiveOverallBudget.value) * 100)
})

const plannedPercentOfBudget = computed(() => {
  if (effectiveOverallBudget.value === 0)
    return 0
  return Math.round((effectivePlannedTotal.value / effectiveOverallBudget.value) * 100)
})

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

const isDoughnutPlanMode = computed(() => {
  return props.statusFilter === 'planned'
})

function getCategoryActiveAmount(cat: CategorySpendingItem): number {
  if (props.statusFilter === 'planned') {
    return cat.plannedAmount || cat.amount
  }
  if (props.statusFilter === 'paid') {
    return cat.paidAmount !== undefined ? cat.paidAmount : cat.amount
  }
  if (isDoughnutPlanMode.value) {
    return (cat.paidAmount || 0) + (cat.plannedAmount || 0) || cat.amount
  }
  return cat.paidAmount !== undefined ? cat.paidAmount : cat.amount
}

function getCategoryBudgetPercent(cat: CategorySpendingItem): number {
  if (!cat.budgetLimit || cat.budgetLimit <= 0)
    return 0
  const activeAmount = getCategoryActiveAmount(cat)
  return Math.round((activeAmount / cat.budgetLimit) * 100)
}

function isCategoryOverBudget(cat: CategorySpendingItem): boolean {
  if (!cat.budgetLimit || cat.budgetLimit <= 0)
    return false
  return getCategoryActiveAmount(cat) > cat.budgetLimit
}

function getCategoryAmountTitle(cat: CategorySpendingItem): string | undefined {
  if (props.statusFilter === 'planned') {
    return cat.budgetLimit
      ? `В планах: ${formatCurrency(cat.plannedAmount || cat.amount, props.mainCurrency)} (лимит: ${formatCurrency(cat.budgetLimit, props.mainCurrency)})`
      : `В планах: ${formatCurrency(cat.amount, props.mainCurrency)}`
  }
  if (props.statusFilter === 'paid') {
    return cat.budgetLimit
      ? `Оплачено: ${formatCurrency(cat.paidAmount || cat.amount, props.mainCurrency)} (лимит: ${formatCurrency(cat.budgetLimit, props.mainCurrency)})`
      : `Оплачено: ${formatCurrency(cat.amount, props.mainCurrency)}`
  }
  return cat.budgetLimit
    ? `Оплачено: ${formatCurrency(cat.paidAmount || 0, props.mainCurrency)}${cat.plannedAmount ? `, в планах: ${formatCurrency(cat.plannedAmount, props.mainCurrency)}` : ''}, лимит: ${formatCurrency(cat.budgetLimit, props.mainCurrency)}`
    : `Всего: ${formatCurrency(cat.amount, props.mainCurrency)}`
}

const doughnutChartItems = computed(() => {
  return props.spendingByCategory.map((cat, i) => {
    let val = 0
    if (props.statusFilter === 'planned') {
      val = cat.plannedAmount || cat.amount
    }
    else if (props.statusFilter === 'paid') {
      val = cat.paidAmount !== undefined ? cat.paidAmount : cat.amount
    }
    else if (isDoughnutPlanMode.value) {
      val = cat.budgetLimit || ((cat.paidAmount || 0) + (cat.plannedAmount || 0)) || cat.amount
    }
    else {
      val = cat.paidAmount !== undefined ? cat.paidAmount : cat.amount
    }

    return {
      name: cat.name,
      value: val,
      colorIndex: cat.colorIndex !== undefined ? cat.colorIndex : i,
      spendingCategoryIndex: i,
    }
  }).filter(item => item.value > 0)
})

const doughnutChartData = computed(() => {
  const items = doughnutChartItems.value
  const labels = items.map(cat => cat.name)
  const data = items.map(cat => cat.value)
  const colors = items.map(item => getCategoryColor(item.colorIndex))

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

const hasDoughnutData = computed(() => doughnutChartData.value.datasets[0].data.length > 0)

const emptyChartMessage = computed(() => {
  if (props.statusFilter === 'planned')
    return 'Нет запланированных трат для отображения.'
  if (props.statusFilter === 'paid')
    return 'Нет оплаченных трат для отображения.'
  return isDoughnutPlanMode.value
    ? 'Нет данных для плановой диаграммы.'
    : 'Нет оплаченных трат для отображения факта.'
})

function externalTooltipHandler(context: { chart: any, tooltip: any }) {
  const { chart, tooltip } = context
  const parent = chart.canvas?.parentNode
  if (!parent)
    return

  let tooltipEl = parent.querySelector('.chartjs-custom-tooltip') as HTMLElement | null

  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'chartjs-custom-tooltip'
    parent.appendChild(tooltipEl)
  }

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = '0'
    return
  }

  if (tooltip.body) {
    const titleLines = tooltip.title || []
    const bodyLines = tooltip.body.map((b: any) => b.lines)

    let innerHtml = ''
    titleLines.forEach((title: string) => {
      innerHtml += `<div class="tooltip-title">${title}</div>`
    })
    bodyLines.forEach((body: string[]) => {
      innerHtml += `<div class="tooltip-body">${body.join('<br>')}</div>`
    })
    tooltipEl.innerHTML = innerHtml
  }

  const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas

  tooltipEl.style.opacity = '1'
  tooltipEl.style.position = 'absolute'
  tooltipEl.style.left = `${positionX + tooltip.caretX}px`
  tooltipEl.style.top = `${positionY + tooltip.caretY}px`

  if (tooltip.yAlign === 'top') {
    tooltipEl.style.transform = 'translate(-50%, 10px)'
  }
  else if (tooltip.yAlign === 'bottom') {
    tooltipEl.style.transform = 'translate(-50%, calc(-100% - 10px))'
  }
  else if (tooltip.xAlign === 'left') {
    tooltipEl.style.transform = 'translate(10px, -50%)'
  }
  else if (tooltip.xAlign === 'right') {
    tooltipEl.style.transform = 'translate(calc(-100% - 10px), -50%)'
  }
  else {
    tooltipEl.style.transform = 'translate(-50%, calc(-100% - 10px))'
  }
}

onUnmounted(() => {
  document.querySelectorAll('.chartjs-custom-tooltip').forEach(el => el.remove())
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
      enabled: false,
      external: externalTooltipHandler,
      callbacks: {
        title: (items: any[]) => {
          if (!items || items.length === 0)
            return ''
          return items[0].label || ''
        },
        label: (context: any) => {
          const val = context.parsed || 0
          const base = props.statusFilter === 'planned'
            ? (effectivePlannedTotal.value || 1)
            : (isDoughnutPlanMode.value ? effectiveOverallBudget.value : (effectivePaidTotal.value || 1))
          const pct = Number(((val / (base || 1)) * 100).toFixed(1))
          return `${formatCurrency(val, props.mainCurrency)} (${pct}%)`
        },
      },
    },
  },
  onHover: (_event: any, elements: any[]) => {
    if (elements && elements.length > 0) {
      const itemIndex = elements[0].index
      const targetItem = doughnutChartItems.value[itemIndex]
      hoveredIndex.value = targetItem ? targetItem.spendingCategoryIndex : null
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
        <h4>Финансы и бюджет</h4>
      </div>
      <KitViewSwitcher
        v-model="currentView"
        :items="viewSwitcherItems"
      />
    </header>

    <div v-if="effectiveOverallBudget > 0 || totalSpend > 0" class="summary-cards">
      <!-- Режим План vs Факт -->
      <template v-if="hasBudget">
        <div class="summary-card total budget">
          <div class="card-top">
            <span class="card-label">
              <span class="label-full">Бюджет поездки</span>
              <span class="label-short">Бюджет</span>
            </span>
            <Icon icon="mdi:wallet-outline" class="card-icon" />
          </div>
          <div class="card-value">
            {{ formatCurrency(effectiveOverallBudget, mainCurrency) }}
          </div>
          <div class="card-meta">
            <span v-if="freeBudget > 0">Свободно: <strong>{{ formatCurrency(freeBudget, mainCurrency) }}</strong></span>
            <span v-else>Остаток: {{ formatCurrency(remainingBudget, mainCurrency) }}</span>
          </div>
        </div>

        <div class="summary-card paid">
          <div class="card-top">
            <span class="card-label">Оплачено</span>
            <Icon icon="mdi:check-circle-outline" class="card-icon" />
          </div>
          <div class="card-value">
            {{ formatCurrency(effectivePaidTotal, mainCurrency) }}
          </div>
          <div class="card-meta">
            <span class="badge paid">{{ paidPercentOfBudget }}%</span>
            <span class="meta-desc">от бюджета</span>
          </div>
        </div>

        <div class="summary-card planned">
          <div class="card-top">
            <span class="card-label">В планах</span>
            <Icon icon="mdi:clock-outline" class="card-icon" />
          </div>
          <div class="card-value">
            {{ formatCurrency(effectivePlannedTotal, mainCurrency) }}
          </div>
          <div class="card-meta">
            <span class="badge planned">{{ plannedPercentOfBudget }}%</span>
            <span class="meta-desc">предстоит</span>
          </div>
        </div>
      </template>

      <!-- Классический режим (без заданного бюджета) -->
      <template v-else>
        <div class="summary-card total">
          <div class="card-top">
            <span class="card-label">
              <span class="label-full">Всего расходов</span>
              <span class="label-short">Всего</span>
            </span>
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
            <span class="meta-desc">по плану</span>
          </div>
        </div>

        <div class="summary-card spontaneous" :class="{ 'is-muted': spontaneousTotal === 0 }">
          <div class="card-top">
            <span class="card-label">
              <span class="label-full">Дополнительные</span>
              <span class="label-short">Доп.</span>
            </span>
            <Icon icon="mdi:sparkles" class="card-icon" />
          </div>
          <div class="card-value">
            {{ formatCurrency(spontaneousTotal, mainCurrency) }}
          </div>
          <div class="card-meta">
            <span v-if="spontaneousTotal > 0" class="badge spontaneous">{{ spontaneousPercent }}%</span>
            <span class="meta-desc">{{ spontaneousTotal > 0 ? 'сверх плана' : 'нет спонтанных' }}</span>
          </div>
        </div>
      </template>
    </div>

    <div v-if="currentView === 'category'">
      <div v-if="spendingByCategory.length > 0" class="categories-content">
        <div class="chart-wrapper">
          <div v-if="hasDoughnutData" class="chart-container" @mouseleave="hoveredIndex = null">
            <Doughnut :data="doughnutChartData" :options="doughnutChartOptions" />
            <div class="chart-center" :class="{ 'is-hovered': hoveredCategory !== null }">
              <span class="center-label">
                {{ hoveredCategory ? hoveredCategory.name : (props.statusFilter === 'planned' ? 'В планах' : 'Оплачено') }}
              </span>
              <span class="center-amount">
                {{ formatCurrency(hoveredCategory ? (props.statusFilter === 'planned' || props.statusFilter === 'paid' ? hoveredCategory.amount : getCategoryActiveAmount(hoveredCategory)) : (props.statusFilter === 'planned' ? effectivePlannedTotal : effectivePaidTotal), mainCurrency) }}
              </span>
              <span class="center-meta">
                {{ hoveredCategory ? `${getCategoryPercent(hoveredCategory.amount)}%` : `${spendingByCategory.length} ${getCategoryWord(spendingByCategory.length)}` }}
              </span>
            </div>
          </div>
          <div v-else class="chart-empty-state">
            <Icon :icon="isDoughnutPlanMode ? 'mdi:chart-donut-variant' : 'mdi:receipt-text-clock-outline'" />
            <span>{{ emptyChartMessage }}</span>
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
            <div class="legend-icon-badge" :style="{ backgroundColor: getCategoryBg(cat.colorIndex ?? index) }">
              <Icon :icon="cat.icon || 'mdi:tag-outline'" :style="{ color: getCategoryColor(cat.colorIndex ?? index) }" />
            </div>

            <div class="legend-details">
              <div class="legend-main-row">
                <span class="legend-title" :title="cat.name">{{ cat.name }}</span>
                <div class="legend-values">
                  <span
                    v-if="(!props.statusFilter || props.statusFilter === 'all') && cat.budgetLimit && cat.budgetLimit > 0"
                    class="legend-percentage"
                    :class="{ 'is-over': isCategoryOverBudget(cat) }"
                  >
                    {{ getCategoryBudgetPercent(cat) }}%
                  </span>
                  <span v-else class="legend-percentage">{{ getCategoryPercent(cat.amount) }}%</span>
                  <span class="legend-separator" />
                  <span
                    class="legend-amount"
                    :title="getCategoryAmountTitle(cat)"
                  >
                    <template v-if="(!props.statusFilter || props.statusFilter === 'all') && cat.budgetLimit && cat.budgetLimit > 0">
                      {{ formatCurrency(getCategoryActiveAmount(cat), mainCurrency) }} / {{ formatCurrency(cat.budgetLimit, mainCurrency) }}
                    </template>
                    <template v-else>
                      {{ formatCurrency(cat.amount, mainCurrency) }}
                    </template>
                  </span>
                </div>
              </div>
              <div class="legend-progress-track">
                <template v-if="props.statusFilter === 'planned' || props.statusFilter === 'paid'">
                  <div
                    class="legend-progress-fill"
                    :style="{
                      width: `${getCategoryPercent(cat.amount)}%`,
                      backgroundColor: getCategoryColor(cat.colorIndex ?? index),
                    }"
                    :title="getCategoryAmountTitle(cat)"
                  />
                </template>
                <template v-else>
                  <div
                    class="legend-progress-fill"
                    :class="{ 'is-over': cat.budgetLimit && (cat.paidAmount || 0) > cat.budgetLimit }"
                    :style="{
                      width: `${cat.budgetLimit && cat.budgetLimit > 0 ? Math.min(100, Math.round(((cat.paidAmount || 0) / cat.budgetLimit) * 100)) : getCategoryPercent(cat.amount)}%`,
                      backgroundColor: (cat.budgetLimit && (cat.paidAmount || 0) > cat.budgetLimit) ? '#EF4444' : getCategoryColor(cat.colorIndex ?? index),
                    }"
                    :title="`Оплачено: ${formatCurrency(cat.paidAmount || 0, mainCurrency)}`"
                  />
                  <div
                    v-if="cat.budgetLimit && cat.budgetLimit > 0 && (cat.plannedAmount || 0) > 0"
                    class="legend-progress-planned"
                    :class="{ 'is-over': ((cat.paidAmount || 0) + (cat.plannedAmount || 0)) > cat.budgetLimit }"
                    :style="{
                      width: `${Math.min(100 - Math.min(100, Math.round(((cat.paidAmount || 0) / cat.budgetLimit) * 100)), Math.round(((cat.plannedAmount || 0) / cat.budgetLimit) * 100))}%`,
                      backgroundColor: ((cat.paidAmount || 0) + (cat.plannedAmount || 0)) > cat.budgetLimit ? '#F87171' : getCategoryColor(cat.colorIndex ?? index),
                    }"
                    :title="`В планах: ${formatCurrency(cat.plannedAmount || 0, mainCurrency)}`"
                  />
                </template>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div v-else class="empty-state">
        <Icon icon="mdi:chart-pie-outline" />
        <p>Здесь появится график, когда вы добавите расходы или смету.</p>
      </div>
    </div>

    <div v-else-if="currentView === 'day'">
      <div v-if="spendingByDay.length > 0" class="days-content">
        <p class="day-chart-caption">
          Факт по дням: учитываются только оплаченные траты с датой.
        </p>
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
        <p>Здесь появится график фактических трат, когда появится оплаченная запись с датой.</p>
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

  :deep(.kit-view-switcher) {
    height: 34px;
    padding: 3px;
    background-color: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-xs);

    .kit-view-switcher-glider {
      top: 3px;
      height: calc(100% - 6px);
      border-radius: calc(var(--r-xs) - 2px);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }

    .kit-view-switcher-button {
      height: 100%;
      min-height: 0;
      padding: 0 12px;
      font-size: 0.8rem;
      gap: 6px;
      border-radius: calc(var(--r-xs) - 2px);

      .kit-view-switcher-icon {
        font-size: 1rem;
      }
    }

    @include media-down(sm) {
      height: 32px;
      padding: 2px;

      .kit-view-switcher-glider {
        top: 2px;
        height: calc(100% - 4px);
      }

      .kit-view-switcher-button {
        padding: 0 8px;
        min-width: 0;
      }
    }
  }
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

  &.paid {
    border-color: color-mix(in srgb, #10b981 35%, var(--border-secondary-color));
    background: linear-gradient(
      135deg,
      var(--bg-primary-color) 0%,
      color-mix(in srgb, #10b981 10%, var(--bg-primary-color)) 100%
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

    .label-short {
      display: none;
    }
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

    &.paid {
      background-color: color-mix(in srgb, #10b981 15%, transparent);
      color: #059669;
    }

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

.chart-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
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

.chart-empty-state {
  width: 180px;
  height: 180px;
  padding: 1rem;
  border: 1px dashed var(--border-secondary-color);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--fg-tertiary-color);
  text-align: center;
  font-size: 0.78rem;
  line-height: 1.35;
  flex-shrink: 0;

  svg {
    font-size: 1.65rem;
  }
}

:deep(.chartjs-custom-tooltip) {
  position: absolute;
  z-index: 20;
  pointer-events: none;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  background-color: rgba(25, 20, 25, 0.95);
  color: #ffffff;
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 0.75rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.15);
  white-space: nowrap;
  backdrop-filter: blur(4px);
  text-align: center;
  line-height: 1.3;

  .tooltip-title {
    font-size: 0.72rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 2px;
  }

  .tooltip-body {
    font-size: 0.82rem;
    font-weight: 700;
    font-family: var(--font-mono);
    color: #ffffff;
  }
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
  z-index: 1;

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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
  min-width: 0;

  &:hover,
  &.is-active {
    border-color: color-mix(in srgb, var(--fg-accent-color) 45%, var(--border-secondary-color));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
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
    min-width: 0;
  }

  .legend-title {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex-shrink: 1;
  }

  .legend-values {
    display: flex;
    align-items: center;
    gap: 0.35rem;
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

    &.is-over {
      color: #ef4444;
      background-color: color-mix(in srgb, #ef4444 15%, transparent);
    }
  }

  .legend-separator {
    width: 1px;
    height: 11px;
    background-color: var(--border-secondary-color);
    flex-shrink: 0;
  }

  .legend-amount {
    font-size: 0.78rem;
    font-weight: 600;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--fg-primary-color);
    white-space: nowrap;
  }

  .legend-progress-track {
    width: 100%;
    height: 4px;
    background-color: var(--border-secondary-color);
    border-radius: 2px;
    overflow: hidden;
    display: flex;
  }

  .legend-progress-fill {
    height: 100%;
    transition: width 0.3s ease;

    &.is-over {
      background-color: #ef4444 !important;
    }
  }

  .legend-progress-planned {
    height: 100%;
    transition: width 0.3s ease;
    opacity: 0.6;
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.4) 2px,
      rgba(255, 255, 255, 0.4) 4px
    );

    &.is-over {
      background-color: #f87171 !important;
    }
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

.day-chart-caption {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
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

  .label-full {
    display: none;
  }

  .label-short {
    display: inline;
  }

  .summary-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
    padding-bottom: 0;
  }

  .summary-card {
    padding: 0.5rem 0.45rem;
    gap: 0.25rem;
    border-radius: var(--r-s);

    .card-top {
      font-size: 0.7rem;
    }

    .card-icon {
      font-size: 0.85rem;
    }

    .card-value {
      font-size: clamp(0.82rem, 3.4vw, 1.05rem);
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-meta {
      font-size: 0.65rem;
      gap: 0.2rem;
      flex-wrap: wrap;
      line-height: 1.2;

      strong {
        white-space: nowrap;
      }

      .meta-desc {
        white-space: nowrap;
      }
    }

    .badge {
      font-size: 0.62rem;
      padding: 1px 4px;
    }
  }
}
</style>
