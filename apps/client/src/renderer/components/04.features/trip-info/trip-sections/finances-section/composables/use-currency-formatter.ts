/**
 * Простой composable для форматирования валют.
 */
export function useCurrencyFormatter() {
  const format = (amount: number, currency: string) => {
    const normalizedCurrency = currency?.trim().toUpperCase()

    try {
      if (!normalizedCurrency)
        throw new RangeError('Empty currency code')

      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount)
    }
    catch {
      const formattedAmount = Math.round(amount).toLocaleString('ru-RU')

      return normalizedCurrency ? `${formattedAmount} ${normalizedCurrency}` : formattedAmount
    }
  }

  return { format }
}
