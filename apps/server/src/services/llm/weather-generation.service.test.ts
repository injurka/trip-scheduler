import { describe, expect, it } from 'bun:test'
import {
  calculateAstronomicalDaylight,
  calculateFeelsLike,
  normalizeCityName,
} from './weather-generation.service'

describe('weather-generation.service astronomical and physics computations', () => {
  it('correctly normalizes city prefixes and suffixes', () => {
    expect(normalizeCityName('г. Мурманск')).toBe('мурманск')
    expect(normalizeCityName('  г.  Териберка, Россия  ')).toBe('териберка')
    expect(normalizeCityName('пос. Териберка')).toBe('териберка')
    expect(normalizeCityName('город Санкт-Петербург')).toBe('санкт-петербург')
    expect(normalizeCityName('с. Териберка, Мурманская область')).toBe('териберка')
  })

  it('accurately identifies Polar Night and twilight for Murmansk and Teriberka in January', () => {
    // Мурманск: широта ~68.97
    const murmanskJan = calculateAstronomicalDaylight(68.97, 1, 10)
    expect(murmanskJan.isPolarNight).toBe(true)
    expect(murmanskJan.daylightHours).toBe(0)
    expect(murmanskJan.daylightText).toContain('Полярная ночь')

    // Териберка: широта ~69.16
    const teriberkaJan = calculateAstronomicalDaylight(69.16, 1, 10)
    expect(teriberkaJan.isPolarNight).toBe(true)
    expect(teriberkaJan.daylightHours).toBe(0)
    expect(teriberkaJan.daylightText).toContain('Полярная ночь')
  })

  it('accurately identifies Polar Day for Arctic locations in June', () => {
    const murmanskJune = calculateAstronomicalDaylight(68.97, 6, 15)
    expect(murmanskJune.isPolarDay).toBe(true)
    expect(murmanskJune.daylightHours).toBe(24)
    expect(murmanskJune.daylightText).toContain('Полярный день')
  })

  it('detects White Nights in Saint Petersburg in June', () => {
    // Санкт-Петербург: широта ~59.93
    const spbJune = calculateAstronomicalDaylight(59.93, 6, 15)
    expect(spbJune.isPolarDay).toBe(false)
    expect(spbJune.isWhiteNights).toBe(true)
    expect(spbJune.daylightText).toContain('белых ночей')
  })

  it('calculates standard daylight hours for Moscow in January and July', () => {
    // Москва: широта ~55.75
    const moscowJan = calculateAstronomicalDaylight(55.75, 1, 15)
    expect(moscowJan.daylightHours).toBeGreaterThanOrEqual(7)
    expect(moscowJan.daylightHours).toBeLessThanOrEqual(8.5)

    const moscowJuly = calculateAstronomicalDaylight(55.75, 7, 15)
    expect(moscowJuly.daylightHours).toBeGreaterThanOrEqual(16)
    expect(moscowJuly.daylightHours).toBeLessThanOrEqual(18)
  })

  it('correctly calculates Wind Chill feels-like temperature under frost and wind', () => {
    // При -15°C и ветре 25 км/ч ощущаемая должна быть значительно ниже
    const feelsCold = calculateFeelsLike(-15, 25)
    expect(feelsCold).toBeLessThan(-22)

    // При плюсовой спокойной погоде ощущаемая совпадает с фактической
    const feelsWarm = calculateFeelsLike(22, 10)
    expect(feelsWarm).toBe(22)
  })
})
