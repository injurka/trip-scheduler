import type { Plan } from '~/shared/types/models/trip'
import { useRequest, useRequestStatus } from '~/plugins/request'

// Mock-данные для price, т.к. их нет в схеме БД
const planPrices: Record<number, { monthly: number, yearly: number }> = {
  1: { monthly: 0, yearly: 0 },
  2: { monthly: 0, yearly: 0 },
  3: { monthly: 0, yearly: 0 },
}

const planDescriptions: Record<number, string> = {
  1: 'Идеально для начала и планирования личных поездок.',
  2: 'Для опытных путешественников и более сложных маршрутов.',
  3: 'Для турагентств и организации групповых поездок.',
}

const planFeatures: Record<number, string[]> = {
  1: ['3 путешествия', '1 ГБ хранилища', '100,000 LLM токенов/мес', 'Базовое планирование', 'Без совместной работы'],
  2: ['50 путешествий', '20 ГБ хранилища', '1,000,000 LLM токенов/мес', 'Расширенное планирование', 'Совместная работа (до 5 чел.)', 'Офлайн-карты'],
  3: ['Неограниченно путешествий', '100 ГБ хранилища', '5,000,000 LLM токенов/мес', 'Все PRO-функции', 'Управление командой', 'Приоритетная поддержка'],
}

export enum EAccountKeys {
  FETCH_PLANS = 'account:fetch-plans',
}

export function useQuota() {
  const billingCycle = ref<'monthly' | 'yearly'>('monthly')
  const rawPlans = ref<Plan[]>([])

  const isLoading = useRequestStatus(EAccountKeys.FETCH_PLANS)

  const plans = computed(() => {
    // Обогащаем планы данными, которые хранятся только на фронте (цены, описания)
    return rawPlans.value.map(plan => ({
      ...plan,
      price: planPrices[plan.id] || { monthly: 0, yearly: 0 },
      description: planDescriptions[plan.id] || 'Описание для этого тарифа не найдено.',
      features: planFeatures[plan.id] || [],
      // ЗАГЛУШКА: Логика определения текущего тарифа
      isCurrent: plan.id === 1,
    }))
  })

  async function fetchPlans() {
    await useRequest({
      key: EAccountKeys.FETCH_PLANS,
      fn: db => db.account.listPlans(),
      onSuccess: (data) => {
        rawPlans.value = data as Plan[]
      },
    })
  }

  function setBillingCycle(cycle: 'monthly' | 'yearly') {
    billingCycle.value = cycle
  }

  return {
    billingCycle,
    plans,
    isLoading,
    fetchPlans,
    setBillingCycle,
  }
}
