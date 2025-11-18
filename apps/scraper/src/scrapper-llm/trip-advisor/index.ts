import { runAttractionDetailScraping } from './attraction-detail/attraction-detail'
import { runAttractionsListScraping } from './attractions-list/attractions-list'

interface ScrapeOptions {
  stage: 'list' | 'detail'
  city: string
  pages: number
  maxDetails: number
}

export async function scrapeTripAdvisor(options: ScrapeOptions) {
  switch (options.stage) {
    case 'list':
      await runAttractionsListScraping({ city: options.city, pages: options.pages })
      break
    case 'detail':
      await runAttractionDetailScraping({ city: options.city, maxDetails: options.maxDetails })
      break
    default:
      console.error(`Неизвестный этап: ${options.stage}`)
  }
}
