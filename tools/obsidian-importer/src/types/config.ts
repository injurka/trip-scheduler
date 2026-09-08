export interface ImporterConfig {
  defaultModel: string
  models: Array<{ title: string, value: string }>
  mainCurrency: string
  exchangeRates: Record<string, number>
  defaultSections: Array<{ type: string, title: string, icon: string }>
  batchSize: number
  llmTimeoutMs: number
  geocoding: {
    photonTimeoutMs: number
    nominatimTimeoutMs: number
  }
}
