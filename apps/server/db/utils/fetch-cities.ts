/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import { MOCK_COUNTRY_DATA } from '../mock/07.country'

export interface CitySeed {
  nameEn: string
  nameRu: string | null
  countryId: number
  population: number | null
  coordinates: { lat: number, lng: number } | null
}

interface ApiCountriesResponse {
  error: boolean
  data: {
    iso2: string
    country: string
    cities: string[]
  }[]
}

interface ApiPopulationResponse {
  error: boolean
  data: {
    city: string
    country: string
    populationCounts: { year: string, value: string }[]
  }[]
}

async function main() {
  try {
    const myCountries = MOCK_COUNTRY_DATA

    console.log(`📍 Загружено ${myCountries.length} стран из локального конфига.`)
    console.log('📡 Запрашиваем данные у API (города и население)...')

    const [citiesRes, popRes] = await Promise.all([
      fetch('https://countriesnow.space/api/v0.1/countries'),
      fetch('https://countriesnow.space/api/v0.1/countries/population/cities'),
    ])

    if (!citiesRes.ok || !popRes.ok) {
      throw new Error('Ошибка при запросе к API')
    }

    const citiesData = (await citiesRes.json()) as ApiCountriesResponse
    const popData = (await popRes.json()) as ApiPopulationResponse

    console.log(`✅ Получены города для ${citiesData.data.length} стран.`)
    console.log(`✅ Получены данные о населении для ${popData.data.length} городов.`)

    const populationMap = new Map<string, number>()

    popData.data.forEach((item) => {
      if (item.populationCounts && item.populationCounts.length > 0) {
        const latest = item.populationCounts.sort((a, b) => Number(b.year) - Number(a.year))[0]
        const key = `${item.country.toLowerCase().trim()}-${item.city.toLowerCase().trim()}`
        populationMap.set(key, Number(latest.value))
      }
    })

    const citiesToInsert: CitySeed[] = []
    let matchedCountriesCount = 0

    myCountries.forEach((myCountry, index: number) => {
      const countryNameEn = myCountry.name

      const generatedId = index + 1

      const apiCountry = citiesData.data.find(
        c => c.country.toLowerCase() === countryNameEn.toLowerCase(),
      )

      if (!apiCountry) {
        console.warn(`⚠️ Страна не найдена в API: ${countryNameEn}`)
        return
      }

      matchedCountriesCount++

      for (const cityName of apiCountry.cities) {
        const popKey = `${apiCountry.country.toLowerCase().trim()}-${cityName.toLowerCase().trim()}`
        const population = populationMap.get(popKey) || null

        citiesToInsert.push({
          nameEn: cityName,
          nameRu: null,
          countryId: generatedId,
          population,
          coordinates: null,
        })
      }
    })

    const outputPath = path.join(__dirname, 'cities-seed.json')
    fs.writeFileSync(outputPath, JSON.stringify(citiesToInsert, null, 2))

    console.log('------------------------------------------------')
    console.log(`🏁 Успешно обработано стран: ${matchedCountriesCount} из ${myCountries.length}`)
    console.log(`🏙 Всего городов сформировано: ${citiesToInsert.length}`)
    console.log(`💾 Результат сохранен в: ${outputPath}`)
  }
  catch (error) {
    console.error('❌ Произошла ошибка:', error)
  }
}

main()
