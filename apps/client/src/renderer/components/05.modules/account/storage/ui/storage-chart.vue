<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ArcElement, Chart as ChartJS, Legend, Title, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

defineProps<Props>()

interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string[]
  }[]
}

interface Props {
  chartData: ChartData
  title: string
}

ChartJS.register(Title, Tooltip, Legend, ArcElement)

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0)
    return '0 Байт'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        color: 'var(--fg-secondary-color)',
        boxWidth: 14,
        padding: 12,
        font: {
          size: 13,
        },
      },
    },
    tooltip: {
      callbacks: {
        label(context: any) {
          let label = context.dataset.label || ''
          if (label)
            label += ': '

          if (context.parsed !== null)
            label += formatBytes(context.parsed)

          return label
        },
      },
    },
  },
}
</script>

<template>
  <div class="chart-wrapper">
    <h3 class="chart-title">
      {{ title }}
    </h3>
    <div class="chart-container">
      <Doughnut
        v-if="chartData.datasets[0].data.length > 0"
        :data="chartData"
        :options="chartOptions"
      />
      <div v-else class="empty-chart">
        <Icon icon="mdi:chart-donut" class="empty-icon" />
        <p>Нет данных для отображения диаграммы</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chart-wrapper {
  background-color: var(--bg-primary-color);
  padding: 1.25rem 1.5rem;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.chart-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--fg-primary-color);
  text-align: center;
}

.chart-container {
  position: relative;
  height: 240px;
  width: 100%;
}

.empty-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }
}
</style>
