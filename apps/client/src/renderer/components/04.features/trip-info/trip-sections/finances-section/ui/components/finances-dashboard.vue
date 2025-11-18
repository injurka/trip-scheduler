<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'
import { useCurrencyFormatter } from '../../composables/use-currency-formatter'

interface Props {
  mainCurrency: string
  spendingByCategory: { name: string, icon: string, amount: number }[]
  spendingByDay: { date: string, amount: number }[]
}

const props = defineProps<Props>()

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, BarElement, LinearScale)

const { format: formatCurrency } = useCurrencyFormatter()

const currentView = ref<'category' | 'day'>('category')
const borderColor = ref('#E0E0E0')
const secondaryTextColor = ref('#6B7280')
const backgroundColor = ref('#FFFFFF')

const doughnutChartData = computed(() => {
  const labels = props.spendingByCategory.map(cat => cat.name)
  const data = props.spendingByCategory.map(cat => cat.amount)

  return {
    labels,
    datasets: [
      {
        backgroundColor: ['#4A90E2', '#50E3C2', '#F5A623', '#F8E71C', '#BD10E0', '#9013FE', '#B8E986', '#7ED321'],
        data,
        borderColor: backgroundColor.value,
        borderWidth: 2,
      },
    ],
  }
})

const barChartData = computed(() => {
  const labels = props.spendingByDay.map(day => formatDate(day.date, { day: 'numeric', month: 'short' }))
  const data = props.spendingByDay.map(day => day.amount)

  return {
    labels,
    datasets: [
      {
        label: `Расходы в ${props.mainCurrency}`,
        backgroundColor: '#4A90E2',
        data,
        borderRadius: 4,
      },
    ],
  }
})

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
}

const barChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
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
  borderColor.value = getComputedStyle(document.documentElement).getPropertyValue('--border-secondary-color').trim()
  secondaryTextColor.value = getComputedStyle(document.documentElement).getPropertyValue('--fg-secondary-color').trim()
  backgroundColor.value = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary-color').trim()
}

onMounted(() => {
  applyThemeStyles()
})
</script>

<template>
  <div class="card">
    <header class="card-header">
      <h4>Расходы</h4>
      <div class="view-switcher">
        <button :class="{ active: currentView === 'category' }" @click="currentView = 'category'">
          <Icon icon="mdi:chart-pie-outline" />
          <span>По категориям</span>
        </button>
        <button :class="{ active: currentView === 'day' }" @click="currentView = 'day'">
          <Icon icon="mdi:chart-bar" />
          <span>По дням</span>
        </button>
      </div>
    </header>

    <!-- By Category View -->
    <div v-if="currentView === 'category'">
      <div v-if="spendingByCategory.length > 0" class="categories-content">
        <div class="chart-container">
          <Doughnut :data="doughnutChartData" :options="doughnutChartOptions" />
        </div>
        <ul class="legend">
          <li v-for="(cat, index) in spendingByCategory" :key="cat.name" class="legend-item">
            <span class="legend-color" :style="{ backgroundColor: doughnutChartData.datasets[0].backgroundColor[index % doughnutChartData.datasets[0].backgroundColor.length] }" />
            <span class="legend-label">{{ cat.name }}</span>
            <span class="legend-value">{{ formatCurrency(cat.amount, mainCurrency) }}</span>
          </li>
        </ul>
      </div>
      <div v-else class="empty-state">
        <Icon icon="mdi:chart-pie-outline" />
        <p>Здесь появится график, когда вы добавите расходы.</p>
      </div>
    </div>

    <!-- By Day View -->
    <div v-else-if="currentView === 'day'">
      <div v-if="spendingByDay.length > 0" class="days-content">
        <div class="chart-container-bar">
          <!-- :options теперь биндится к computed свойству -->
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
.card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  h4 {
    margin: 0;
  }
}

.view-switcher {
  display: flex;
  align-items: center;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  padding: 2px;
  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 4px 10px;
    border-radius: var(--r-s);
    font-size: 0.875rem;
    color: var(--fg-secondary-color);
    &.active {
      background-color: var(--bg-primary-color);
      color: var(--fg-primary-color);
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
}

.categories-content {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  min-height: 170px;
}

.chart-container {
  position: relative;
  height: 170px;
  width: 170px;
  flex-shrink: 0;
}

.days-content {
  min-height: 170px;
}
.chart-container-bar {
  position: relative;
  height: 170px;
}

.legend {
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  font-size: 0.9rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  .legend-label {
    flex-grow: 1;
    color: var(--fg-secondary-color);
  }
  .legend-value {
    font-weight: 500;
  }
}

.empty-state {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary-color);
  text-align: center;
  padding: 1rem;
  min-height: 170px;
  font-size: 2.5rem;
  p {
    font-size: 0.9rem;
  }
}

@include media-down(sm) {
  .categories-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .chart-container {
    width: 100%;
    height: 150px;
  }
  .legend {
    width: 100%;
  }
}
</style>
