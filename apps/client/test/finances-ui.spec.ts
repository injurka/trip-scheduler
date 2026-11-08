import type { FinancesSectionContent, Transaction } from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/models/types'
import { FinanceTransactionSchema } from '@injurka/finance-contract'
import { mount, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { normalizeTransactionPhotos, useFinancesSection } from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/composables/use-finances-section'
import Dashboard from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/finances-dashboard.vue'
import FinancesDateFilter from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/finances-date-filter.vue'
import TransactionsList from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/transactions-list.vue'
import FinancesSection from '../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/finances-section.vue'

vi.mock('~/shared/composables/use-confirm', () => ({ useConfirm: () => async () => false }))
vi.mock('~/plugins/request', () => ({ useRequest: vi.fn(), useRequestStatus: () => ({ value: false }) }))
vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))
vi.mock('vue-chartjs', () => ({
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], render: () => null },
  Bar: { name: 'Bar', props: ['data', 'options'], render: () => null },
}))
// Editors are outside the filtering flow and require API services.
vi.mock('../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/ai-finances-creator.vue', () => ({ default: { render: () => null } }))
vi.mock('../src/renderer/components/04.features/trip-info/trip-sections/finances-section/ui/components/transaction-form-dialog.vue', () => ({ default: { name: 'TransactionFormDialog', props: ['visible'], render: () => null } }))

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

  it('normalizes, clones, and validates transaction photos up to the 3-photo limit', () => {
    expect(normalizeTransactionPhotos(['  /trips/a.jpg  ', '', '/trips/a.jpg', '/trips/b.jpg', '/trips/c.jpg', '/trips/d.jpg'])).toEqual([
      '/trips/a.jpg',
      '/trips/b.jpg',
      '/trips/c.jpg',
    ])
    expect(normalizeTransactionPhotos(['   ', ''])).toBeUndefined()

    const state = useFinancesSection({ section: { id: 'finance', type: 'finances', content: content() }, readonly: false }, vi.fn())
    state.openTransactionForm()
    state.saveTransaction({
      title: 'Ужин с чеком',
      amount: 1200,
      currency: 'RUB',
      categoryId: 'food',
      photos: [' /trips/r1.jpg ', '/trips/r1.jpg', '/trips/r2.jpg'],
    })

    const saved = state.transactions.value[0]
    expect(saved.photos).toEqual(['/trips/r1.jpg', '/trips/r2.jpg'])

    // Editing clones photos array so unsaved mutations do not leak
    state.openTransactionForm(saved)
    state.transactionToEdit.value!.photos!.push('/trips/unsaved.jpg')
    expect(saved.photos).toEqual(['/trips/r1.jpg', '/trips/r2.jpg'])

    // Validating via contract schema
    expect(FinanceTransactionSchema.safeParse(saved).success).toBe(true)
    expect(FinanceTransactionSchema.safeParse({
      ...saved,
      photos: ['1.jpg', '2.jpg', '3.jpg', '4.jpg'],
    }).success).toBe(false)
  })

  it('renders miniature photo thumbnails in transaction rows and opens the image viewer on click', async () => {
    const initial = content()
    const listWrapper = mount(TransactionsList, {
      props: {
        transactions: [
          transaction(
            'tx-3-photos',
            'food',
            450,
            {
              title: 'Том Ям',
              notes: 'Чек из кафе',
              photos: ['/trips/p1.jpg', '/trips/p2.jpg', '/trips/p3.jpg'],
            },
          ),
        ],
        categories: initial.categories,
        settings: initial.settings,
        readonly: true,
        filteredTotal: 450,
        statusFilter: 'all',
      },
      global: {
        stubs: {
          KitImage: { name: 'KitImage', props: ['src', 'alt'], template: '<img class="stub-kit-image" :src="src" :alt="alt" />' },
          KitImageViewer: { name: 'KitImageViewer', props: ['visible', 'currentIndex', 'images'], template: '<div class="stub-image-viewer" />' },
        },
      },
    })
    wrappers.push(listWrapper)

    const thumbs = listWrapper.findAll('.tx-photo-thumb')
    expect(thumbs).toHaveLength(2)
    expect(thumbs[1].find('.tx-photo-more-badge').text()).toBe('+1')
    expect(listWrapper.findComponent({ name: 'KitImageViewer' }).exists()).toBe(false)

    await thumbs[1].trigger('click')
    const viewer = listWrapper.findComponent({ name: 'KitImageViewer' })
    expect(viewer.exists()).toBe(true)
    expect(viewer.props('currentIndex')).toBe(1)
    expect(viewer.props('images')).toHaveLength(3)
    expect(viewer.props('images')[0].caption).toContain('Том Ям')
    expect(viewer.props('images')[0].caption).toContain('Чек из кафе')
  })

  it('renders IMP-027 redesigned control panel and triggers actions correctly', async () => {
    const wrapper = mount(FinancesSection, {
      props: { section: { id: 'finance', type: 'finances', content: content() }, readonly: false },
      global: {
        stubs: {
          FinancesDashboard: true,
          TransactionsList: true,
          AiFinancesCreator: true,
          CategoryManagerDialog: { name: 'CategoryManagerDialog', props: ['visible'], render: () => null },
          BudgetSettingsDialog: { name: 'BudgetSettingsDialog', props: ['visible'], render: () => null },
          KitCalendarRange: true,
        },
      },
    })
    wrappers.push(wrapper)

    const controlCard = wrapper.find('.finances-control-card')
    expect(controlCard.exists()).toBe(true)
    expect(controlCard.find('.control-card-title').text()).toBe('Финансы')

    // 1. "Добавить трату"
    const addBtn = wrapper.find('.action-primary')
    expect(addBtn.exists()).toBe(true)
    expect(addBtn.text()).toContain('Добавить трату')
    expect(wrapper.findComponent({ name: 'TransactionFormDialog' }).props('visible')).toBe(false)
    await addBtn.trigger('click')
    expect(wrapper.findComponent({ name: 'TransactionFormDialog' }).props('visible')).toBe(true)

    // 2. "По чеку"
    const aiBtn = wrapper.find('.action-secondary')
    expect(aiBtn.exists()).toBe(true)
    expect(aiBtn.text()).toContain('По чеку')
    expect(aiBtn.classes()).not.toContain('is-active')
    expect(wrapper.find('.ai-creator-wrapper').attributes('style')).toContain('display: none')
    await aiBtn.trigger('click')
    expect(aiBtn.classes()).toContain('is-active')
    expect(wrapper.find('.ai-creator-wrapper').attributes('style') || '').not.toContain('display: none')

    // 3. "Настройки"
    const settingsBtn = wrapper.find('.settings-btn')
    expect(settingsBtn.exists()).toBe(true)
    expect(settingsBtn.text()).toContain('Настройки')
    expect(wrapper.findComponent({ name: 'BudgetSettingsDialog' }).props('visible')).toBe(false)
    await settingsBtn.trigger('click')
    expect(wrapper.findComponent({ name: 'BudgetSettingsDialog' }).props('visible')).toBe(true)

    // 4. "Категории" (both in control card footer and near filter pills)
    const categoriesBtn = wrapper.find('.categories-btn')
    expect(categoriesBtn.exists()).toBe(true)
    expect(categoriesBtn.text()).toContain('Категории')
    expect(wrapper.findComponent({ name: 'CategoryManagerDialog' }).props('visible')).toBe(false)
    await categoriesBtn.trigger('click')
    expect(wrapper.findComponent({ name: 'CategoryManagerDialog' }).props('visible')).toBe(true)

    const filterPillCat = wrapper.find('.manage-categories-filter-pill')
    expect(filterPillCat.exists()).toBe(true)
  })

  it('hides edit controls in IMP-027 control panel in readonly mode', () => {
    const wrapper = mount(FinancesSection, {
      props: { section: { id: 'finance', type: 'finances', content: content() }, readonly: true },
      global: {
        stubs: {
          FinancesDashboard: true,
          TransactionsList: true,
          AiFinancesCreator: true,
          CategoryManagerDialog: { name: 'CategoryManagerDialog', props: ['visible'], render: () => null },
          BudgetSettingsDialog: { name: 'BudgetSettingsDialog', props: ['visible'], render: () => null },
          KitCalendarRange: true,
        },
      },
    })
    wrappers.push(wrapper)

    expect(wrapper.find('.control-card-title').text()).toBe('Финансы')
    expect(wrapper.find('.settings-btn').exists()).toBe(false)
    expect(wrapper.find('.control-card-actions').exists()).toBe(false)
    expect(wrapper.find('.control-card-footer').exists()).toBe(false)
    expect(wrapper.find('.manage-categories-filter-pill').exists()).toBe(false)
  })

  it('bUG-026: displays formatted date and opens mobile Bottom Sheet with presets and controls', async () => {
    window.innerWidth = 400
    window.dispatchEvent(new Event('resize'))

    const dateFilterValue = ref<{ start: string | null, end: string | null }>({
      start: '2026-11-05',
      end: '2026-11-08',
    })

    const wrapper = mount(FinancesDateFilter, {
      props: {
        'modelValue': dateFilterValue.value,
        'onUpdate:modelValue': (val: { start: string | null, end: string | null }) => {
          dateFilterValue.value = val
        },
      },
      global: {
        stubs: {
          KitCalendarRange: {
            name: 'KitCalendarRange',
            props: ['modelValue', 'fullWidth'],
            template: '<div class="stub-calendar-range" :class="{ \'is-full-width\': fullWidth }"></div>',
          },
          KitBottomSheet: {
            name: 'KitBottomSheet',
            props: ['modelValue', 'title'],
            template: `
              <div v-if="modelValue" class="stub-bottom-sheet" :data-title="title">
                <slot />
                <slot name="footer" />
              </div>
            `,
          },
        },
      },
    })
    wrappers.push(wrapper)

    const btn = wrapper.find('.date-filter-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('5 нояб. - 8 нояб.')

    // Open date picker in mobile sheet
    await btn.trigger('click')
    await nextTick()

    const sheet = wrapper.find('.stub-bottom-sheet')
    expect(sheet.exists()).toBe(true)
    expect(sheet.attributes('data-title')).toBe('Выбрать период')

    // Range summary cards
    const summaryCards = wrapper.findAll('.range-card')
    expect(summaryCards.length).toBe(2)
    expect(summaryCards[0].text()).toContain('05.11.2026')
    expect(summaryCards[1].text()).toContain('08.11.2026')

    // Presets
    const presets = wrapper.findAll('.preset-pill')
    expect(presets.length).toBe(4)
    expect(presets.map(p => p.text())).toEqual(['Сегодня', '7 дней', 'Этот месяц', 'Всё время'])

    // Full-width calendar
    const calendar = wrapper.find('.stub-calendar-range')
    expect(calendar.exists()).toBe(true)
    expect(calendar.classes()).toContain('is-full-width')

    // Select "Всё время" preset
    const allTimePreset = presets.find(p => p.text() === 'Всё время')!
    await allTimePreset.trigger('click')
    await nextTick()

    // Values in summary cards change to placeholder
    expect(summaryCards[0].text()).toContain('—')
    expect(summaryCards[1].text()).toContain('—')

    // Click "Применить"
    const applyBtn = wrapper.findAll('button').find(b => b.text().includes('Применить'))!
    await applyBtn.trigger('click')
    await nextTick()

    expect(dateFilterValue.value).toEqual({ start: null, end: null })
  })

  it('bUG-026: displays formatted date and renders Desktop Popover when on wide screen', async () => {
    window.innerWidth = 1200
    window.dispatchEvent(new Event('resize'))

    const dateFilterValue = ref<{ start: string | null, end: string | null }>({
      start: '2026-11-05',
      end: '2026-11-08',
    })

    const wrapper = mount(FinancesDateFilter, {
      props: {
        'modelValue': dateFilterValue.value,
        'onUpdate:modelValue': (val: { start: string | null, end: string | null }) => {
          dateFilterValue.value = val
        },
      },
    })
    wrappers.push(wrapper)
    await nextTick()

    const btn = wrapper.find('.date-filter-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-haspopup')).toBe('dialog')
    expect(wrapper.find('.stub-bottom-sheet').exists()).toBe(false)
  })
})
