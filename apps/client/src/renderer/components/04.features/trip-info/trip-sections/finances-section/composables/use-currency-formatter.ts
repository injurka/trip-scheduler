/**
 * Простой composable для форматирования валют.
 */
export function useCurrencyFormatter() {
  const format = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return { format }
}
