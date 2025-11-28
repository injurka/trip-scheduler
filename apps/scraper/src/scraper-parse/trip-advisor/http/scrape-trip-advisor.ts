/* eslint-disable no-console */
import axios from 'axios'
import * as cheerio from 'cheerio'
import { z } from 'zod'

const RecommendationSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  image: z.string().url(),
})

const RecommendationsSchema = z.array(RecommendationSchema)

type Recommendation = z.infer<typeof RecommendationSchema>

interface ScrapeOptions {
  url: string
}

export async function scrapeTripAdvisor(options: ScrapeOptions): Promise<Recommendation[]> {
  const { url } = options
  console.log(`Attempting to scrape ${url} with a direct HTTP request...`)

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
      },
    })

    const html = response.data
    console.log('Successfully downloaded HTML content.')

    const $ = cheerio.load(html)

    const cardSelector = 'div[data-part="ListSections"] div[data-automation="cardWrapper"]'
    const cardElements = $(cardSelector)

    console.log(`Found ${cardElements.length} attraction cards using selector.`)

    if (cardElements.length === 0) {
      console.error('Scraping failed: The necessary data is not present in the initial HTML.')
      console.error('This is typical for JavaScript-driven websites. The content is loaded dynamically after the page loads, which this method cannot execute.')
      return []
    }

    const allRecommendations: Recommendation[] = []

    cardElements.each((_index, element) => {
      const card = $(element)
      const linkElement = card.find('a[href*="/Attraction_Review-"]')
      const titleElement = card.find('.VLKGO h3')
      const imageElement = card.find('picture > img')

      const title = titleElement.text()?.replace(/^\d+\.\s*/, '').trim()
      const relativeUrl = linkElement.attr('href')
      const absoluteUrl = relativeUrl ? new URL(relativeUrl, 'https://www.tripadvisor.com').toString() : undefined
      const image = imageElement.attr('src')

      if (title && absoluteUrl && image) {
        allRecommendations.push({
          title,
          url: absoluteUrl,
          image,
        })
      }
    })

    const validationResult = RecommendationsSchema.safeParse(allRecommendations)
    if (!validationResult.success) {
      console.error('Data validation failed:', validationResult.error)
      return []
    }

    return validationResult.data
  }
  catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`HTTP request failed with status ${error.response?.status}: ${error.message}`)
      if (error.response?.status === 403) {
        console.error('Received a 403 Forbidden error. The request was blocked by the server\'s security systems (e.g., Cloudflare, Akamai).')
      }
    }
    else {
      console.error('An unexpected error occurred:', error)
    }
    return []
  }
}
