import type { FinancesSectionContent, Transaction } from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/models/types'
import { mount, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useFinancesSection } from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/composables/use-finances-section'
import Dashboard from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/finances-dashboard.vue'
import FinancesSection from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/finances-section.vue'

vi.mock('~/shared/composables/use-confirm', () => ({ useConfirm: () => async () => false }))
vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))
vi.mock('vue-chartjs', () => ({
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], render: () => null },
  Bar: { name: 'Bar', props: ['data', 'options'], render: () => null },
}))
// Editors are outside the filtering flow and require API services.
vi.mock('../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/ai-finances-creator.vue', () => ({ default: { render: () => null } }))

function transaction(
  id: string,
  categoryId: string | null,
  amount: number,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    title: id,
    categoryId,
    amount,
    currency: 'RUB',
    date: '2026-11-08',
    status: 'paid',
    source: 'manual',
    isSpontaneous: false,
    ...extra,
  }
}
function content(): FinancesSectionContent {
  return {
    schemaVersion: 1,
    settings: { mainCurrency: 'RUB', exchangeRates: { USD: 100 }, totalBudget: 10000 },
    categories: [
      { id: 'food', name: 'Еда', icon: 'mdi:food', budgetLimit: 500 },
      { id: 'transport', name: 'Транспорт', icon: 'mdi:train', budgetLimit: 500 },
      { id: 'unused', name: 'Без трат', icon: 'mdi:tag', budgetLimit: 200 },
    ],
    transactions: [
      transaction('food-paid', 'food', 100),
      transaction(
        'food-planned',
        'food',
        50,
        { status: 'planned' },
      ),
      transaction(
        'transport-paid',
        'transport',
        2,
        { currency: 'USD', isSpontaneous: true },
      ),
      transaction('other-paid', null, 30),
      transaction(
        'no-rate',
        'food',
        1000,
        { currency: 'EUR' },
      ),
    ],
  }
}
const wrappers: { unmount: () => void }[] = []
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  wrappers.length = 0
})

function renderHarness(initial = content()) {
  let state!: ReturnType<typeof useFinancesSection>
  const emit = vi.fn()
  const wrapper = mount(defineComponent({
    setup() {
      state = useFinancesSection({ section: { id: 'finance', type: 'finances', content: initial }, readonly: true }, emit)

      return () => h(Dashboard, {
        mainCurrency: state.settings.value.mainCurrency,
        spendingByCategory: state.spendingByCategory.value,
        spendingByDay: state.spendingByDay.value,
        overallBudget: state.overallBudget.value,
        paidTotal: state.paidTotal.value,
        plannedTotal: state.plannedTotal.value,
        spontaneousTotal: state.spontaneousTotal.value,
        filteredTotal: state.filteredTotal.value,
        statusFilter: state.statusFilter.value,
      })
    },
  }))
  wrappers.push(wrapper)

  return { wrapper, state, emit }
}
function center(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.center-amount').text().replace(/\s/g, '')
}

describe('finance filters and reactive charts', () => {
  it('cycles only / exclude / reset and recalculates the chart, center, list and daily amounts together', async () => {
    const { wrapper, state, emit } = renderHarness()
    expect(center(wrapper)).toBe('330₽')
    state.toggleCategoryFilter('food')
    await nextTick()
    expect(state.filteredTransactions.value.map(tx => tx.id)).toEqual(['food-paid', 'food-planned', 'no-rate'])
    expect(state.filteredTotal.value).toBe(150)
    expect(state.spendingByDay.value).toEqual([{ date: '2026-11-08', amount: 100 }])
    expect(center(wrapper)).toBe('100₽')
    const chart = wrapper.findComponent({ name: 'Doughnut' })
    expect(chart.props('data').datasets[0].data).toEqual([100])
    expect(chart.props('options').plugins.tooltip.callbacks.label({ parsed: 100 })).toContain('(100%)')

    state.toggleCategoryFilter('food')
    await nextTick()
    expect(state.selectedCategoryFilters.value).toEqual([])
    expect(state.excludedCategoryFilters.value).toEqual(['food'])
    expect(state.filteredTotal.value).toBe(230)
    expect(center(wrapper)).toBe('230₽')
    expect(state.spendingByCategory.value.some(cat => cat.id === 'food')).toBe(false)

    state.toggleCategoryFilter('food')
    await nextTick()
    expect(center(wrapper)).toBe('330₽')
    expect(state.excludedCategoryFilters.value).toEqual([])
    expect(emit).not.toHaveBeenCalled()
    expect(state.overallBudget.value).toBe(10000)
  })

  it('combines multiple included and excluded categories, including uncategorized expenses', async () => {
    const { state } = renderHarness()
    state.toggleCategoryFilter('food')
    state.toggleCategoryFilter('transport')
    expect(state.filteredTotal.value).toBe(350)
    state.toggleCategoryFilter('food')
    expect(state.filteredTotal.value).toBe(200)
    state.toggleCategoryFilter(null)
    state.toggleCategoryFilter('cat-other')
    expect(state.filteredTotal.value).toBe(30)
    state.toggleCategoryFilter('cat-other')
    expect(state.filteredTotal.value).toBe(350)
    state.toggleCategoryFilter(null)
    expect(state.filteredTotal.value).toBe(380)
    expect(state.excludedCategoryFilters.value).toEqual([])
  })

  it('combines category, status, spontaneous and date filters and handles empty selections', async () => {
    const { state, wrapper } = renderHarness()
    state.toggleCategoryFilter('food')
    state.statusFilter.value = 'planned'
    await nextTick()
    expect(center(wrapper)).toBe('50₽')
    expect(state.spendingByDay.value[0].amount).toBe(50)
    state.typeFilter.value = 'spontaneous'
    await nextTick()
    expect(state.filteredTotal.value).toBe(0)
    expect(wrapper.find('.chart-empty-state').exists()).toBe(true)
    state.toggleCategoryFilter(null)
    state.statusFilter.value = 'paid'
    await nextTick()
    expect(center(wrapper)).toBe('200₽')
    state.dateFilter.value = { start: '2026-11-09', end: null }
    await nextTick()
    expect(state.spendingByDay.value).toEqual([])
    expect(wrapper.find('.center-amount').exists()).toBe(false)
  })

  it('updates the daily chart while it is visible', async () => {
    const { wrapper, state } = renderHarness()
    await wrapper.findAll('.kit-view-switcher button').find(button => button.text().includes('По дням'))!.trigger('click')
    const bar = () => wrapper.findComponent({ name: 'Bar' })
    expect(bar().props('data').datasets[0].data).toEqual([330])
    state.toggleCategoryFilter('food')
    await nextTick()
    expect(bar().props('data').datasets[0].data).toEqual([100])
    state.statusFilter.value = 'planned'
    await nextTick()
    expect(bar().props('data').datasets[0].data).toEqual([50])
    expect(wrapper.find('.day-chart-caption').text()).toContain('Планы по дням')
  })

  it('uses paid amounts for percentages in all-status mode and clears obsolete hover when filtering', async () => {
    const { wrapper, state } = renderHarness()
    const chart = wrapper.findComponent({ name: 'Doughnut' })
    expect(chart.props('options').plugins.tooltip.callbacks.label({ parsed: 100 })).toContain('(30.3%)')
    const food = wrapper.findAll('.legend-item').find(item => item.text().includes('Еда'))!
    expect(food.find('.legend-percentage').text()).toBe('20%') // paid / category budget
    await food.trigger('mouseenter')
    expect(wrapper.find('.center-meta').text()).toBe('30.3%')
    state.toggleCategoryFilter('transport')
    await nextTick()
    expect(wrapper.find('.center-label').text()).toBe('Оплачено')
    expect(center(wrapper)).toBe('200₽')
  })

  it('keeps legend amounts and percentages consistent with paid chart data when plans are also present', () => {
    const initial = content()
    initial.categories.forEach(category => delete category.budgetLimit)
    const { wrapper } = renderHarness(initial)
    const food = wrapper.findAll('.legend-item').find(item => item.text().includes('Еда'))!
    expect(food.find('.legend-amount').text().replace(/\s/g, '')).toBe('100₽')
    expect(food.find('.legend-percentage').text()).toBe('30.3%')
  })

  it('shows only / excluded state in the category buttons and resets both states', async () => {
    const wrapper = shallowMount(FinancesSection, {
      props: { section: { id: 'finance', type: 'finances', content: content() }, readonly: true },
    })
    wrappers.push(wrapper)
    const food = wrapper.findAll('.category-pill').find(button => button.text() === 'Еда')!
    await food.trigger('click')
    expect(food.text()).toContain('Только')
    expect(food.attributes('aria-pressed')).toBe('true')
    await food.trigger('click')
    expect(food.text()).toContain('Исключено')
    expect(food.classes()).toContain('excluded')
    expect(wrapper.find('.reset-badge').text()).toBe('1')
    await food.trigger('click')
    expect(food.attributes('aria-pressed')).toBe('false')
    await food.trigger('click')
    await food.trigger('click')
    await wrapper.find('.is-all').trigger('click')
    expect(food.classes()).not.toContain('excluded')
    expect(wrapper.find('.reset-filters-btn').exists()).toBe(false)
    await food.trigger('click')
    await food.trigger('click')
    await wrapper.find('.reset-filters-btn').trigger('click')
    expect(wrapper.find('.reset-filters-btn').exists()).toBe(false)
    expect(wrapper.find('.is-all').classes()).toContain('active')
  })
})
