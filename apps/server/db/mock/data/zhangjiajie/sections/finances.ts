import { TRIP_ID } from '../constants'

export const MOCK_SECTION_FINANCES = {
  id: crypto.randomUUID(),
  tripId: TRIP_ID,
  type: 'finances' as const,
  title: 'Финансы',
  icon: 'mdi:cash-multiple',
  content: {
    settings: { mainCurrency: 'RUB', exchangeRates: { CNY: 12.5, USD: 90, EUR: 100 } },
    categories: [
      { id: 'cat-housing', name: 'Жильё', icon: 'mdi:bed', isDefault: true },
      { id: 'cat-transport', name: 'Транспорт', icon: 'mdi:train-car', isDefault: true },
      { id: 'cat-flights', name: 'Авиабилеты', icon: 'mdi:airplane', isDefault: true },
      { id: 'cat-food', name: 'Еда и напитки', icon: 'mdi:food-fork-drink', isDefault: true },
      { id: 'cat-entertainment', name: 'Развлечения', icon: 'mdi:party-popper', isDefault: true },
      { id: 'cat-shopping', name: 'Покупки', icon: 'mdi:shopping-outline', isDefault: true },
      { id: 'cat-other', name: 'Прочее', icon: 'mdi:dots-horizontal-circle-outline', isDefault: true },
    ],
    transactions: [
      // --- Общие траты (без даты, будут вверху списка) ---
      { id: crypto.randomUUID(), title: 'Авиабилеты: Чунцин → Москва', amount: 40000, currency: 'RUB', categoryId: 'cat-flights', notes: 'Оплата картой' },
      { id: crypto.randomUUID(), title: 'Авиабилеты: Москва → Чанша', amount: 32600, currency: 'RUB', categoryId: 'cat-flights', notes: 'Примерная цена' },
      { id: crypto.randomUUID(), title: 'Авиабилеты: Москва → Ульяновск', amount: 9700, currency: 'RUB', categoryId: 'cat-flights' },
      { id: crypto.randomUUID(), title: 'Авиабилеты: Ульяновск → Москва', amount: 4500, currency: 'RUB', categoryId: 'cat-flights', notes: 'Примерная цена' },
      { id: crypto.randomUUID(), title: 'Отель в Чунцине (Homeinn Plus)', amount: 16270, currency: 'RUB', categoryId: 'cat-housing', notes: 'Номер бронирования: 1539358965862331' },
      { id: crypto.randomUUID(), title: 'Отель в Чжанцзяцзе (Vienna 3)', amount: 10485, currency: 'RUB', categoryId: 'cat-housing' },
      { id: crypto.randomUUID(), title: 'Отель в Чанше (FUNGEE S)', amount: 8852.37, currency: 'RUB', categoryId: 'cat-housing', notes: 'Номер бронирования: 1539358980986251' },
      { id: crypto.randomUUID(), title: 'Отель в Фэнхуане (Tianqingshe)', amount: 2635, currency: 'RUB', categoryId: 'cat-housing' },
      { id: crypto.randomUUID(), title: 'Страховка на поездку', amount: 3500, currency: 'RUB', categoryId: 'cat-other', notes: 'Полис №123456789' },

      // --- Траты по дням (с датой) ---
      { id: crypto.randomUUID(), title: 'Билет на поезд: Чжанцзяцзе → Фэнхуан', amount: 1015, currency: 'RUB', categoryId: 'cat-transport', notes: 'Номер бронирования: 1539359259369506', date: '2025-10-26' },
      { id: crypto.randomUUID(), title: 'Билет на поезд: Чанша → Чжанцзяцзе', amount: 2215, currency: 'RUB', categoryId: 'cat-transport', notes: 'Номер бронирования: 1539359259352082', date: '2025-10-22' },
    ],
  },
  order: 2,
}
