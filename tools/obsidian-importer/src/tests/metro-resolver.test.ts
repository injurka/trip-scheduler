import type { ActivityPayload, ActivitySectionMetro, MetroRide } from '../types'
import { describe, expect, test } from 'bun:test'
import kaohsiung from '../../../metro-import/data/kaohsiung.json'
import taichung from '../../../metro-import/data/taichung.json'
import taipei from '../../../metro-import/data/taipei.json'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { createMetroActivityResolver } from '../lib/metro-resolver'
import { parseActivitiesFromMarkdown } from '../parsers/activity'

const catalog = {
  listMetroSystems: async () => [{ id: taipei.id, city: taipei.city }],
  getMetroSystemDetails: async () => taipei,
}
function activity(overrides: Partial<MetroRide> = {}): ActivityPayload {
  return {
    title: 'Метро',
    startTime: '09:00',
    endTime: '09:30',
    tag: 'transport',
    sections: [{
      id: 'metro',
      type: 'metro',
      mode: 'free',
      systemId: null,
      rides: [{ id: 'ride', lineId: null, lineNumber: 'R', lineColor: '#123456', lineName: 'Tamsui–Xinyi Line', startStation: 'Dongmen (R07)', endStation: 'Chiang Kai-shek Memorial Hall (R08)', startStationId: null, endStationId: null, direction: 'Tamsui', stops: 99, ...overrides }],
    }],
  }
}
function metro(act: ActivityPayload): ActivitySectionMetro {
  return act.sections!.find(section => section.type === 'metro') as ActivitySectionMetro
}

describe('metro catalog resolution', () => {
  test('maps codes and aliases to canonical server IDs and recomputes stops/colors', async () => {
    const original = activity()
    const result = metro(await createMetroActivityResolver(catalog)(original, 'Тайбэй · Храм Луншань'))
    expect(result).toMatchObject({ mode: 'city', systemId: 'tw-taipei' })
    expect(result.rides[0]).toMatchObject({ id: 'ride', lineId: 'tw-taipei-r', startStationId: 'tw-taipei-r07', endStationId: 'tw-taipei-r08', stops: 1, lineColor: '#E3002C' })
    expect(metro(original).mode).toBe('free')
  })
  test('matches exact English or Chinese station names when no codes are given', async () => {
    const result = metro(await createMetroActivityResolver(catalog)(activity({ lineNumber: null, lineName: 'Tamsui-Xinyi Line', startStation: 'Dongmen', endStation: '中正紀念堂' }), 'Taipei'))
    expect(result.mode).toBe('city')
  })
  test('does not guess unknown cities, lines, stations or equal endpoints', async () => {
    const resolve = createMetroActivityResolver(catalog)
    expect(metro(await resolve(activity(), 'Гаосюн')).mode).toBe('free')
    for (const overrides of [{ lineNumber: 'Unknown' }, { endStation: 'Unknown' }, { endStation: 'R07' }, { endStation: 'R99' }, { startStation: 'R07 или R99' }])
      expect(metro(await resolve(activity(overrides), 'Тайбэй')).mode).toBe('free')
  })
  test('keeps the whole multi-ride block manual if one ride cannot be mapped', async () => {
    const original = activity()
    metro(original).rides.push({ ...metro(original).rides[0]!, id: 'unmatched', endStation: 'unknown' })
    expect(await createMetroActivityResolver(catalog)(original, 'Тайбэй')).toEqual(original)
  })
  test('resolves direction-specific orange branches without a false O21–O50 connection', async () => {
    const resolve = createMetroActivityResolver(catalog)
    const luzhou = metro(await resolve(activity({ lineNumber: 'O', startStation: 'O12', endStation: 'O50', direction: 'Luzhou' }), 'Тайбэй'))
    expect(luzhou.rides[0]).toMatchObject({ lineId: 'tw-taipei-o-luzhou', stops: 1 })
    expect(metro(await resolve(activity({ lineNumber: 'O', startStation: 'O01', endStation: 'O12', direction: '' }), 'Тайбэй')).mode).toBe('free')
    expect(metro(await resolve(activity({ lineNumber: 'O', startStation: 'O01', endStation: 'O12', direction: 'Luzhou' }), 'Тайбэй')).rides[0]!.lineId).toBe('tw-taipei-o-luzhou')
  })
  test('keeps existing city sections intact and rejects ambiguous cities', async () => {
    const a = activity()
    metro(a).mode = 'city'
    metro(a).systemId = 'preserved'
    expect(await createMetroActivityResolver(catalog)(a, 'Тайбэй')).toBe(a)
    const ambiguous = { ...catalog, listMetroSystems: async () => [{ id: 'one', city: 'City' }, { id: 'two', city: 'City' }] }
    expect(metro(await createMetroActivityResolver(ambiguous)(activity(), 'City')).mode).toBe('free')
  })
  test('caches requests for one run, including failures, and skips activities without metro', async () => {
    let systems = 0
    let details = 0
    const resolve = createMetroActivityResolver({
      listMetroSystems: async () => {
        systems++
        return catalog.listMetroSystems()
      },
      getMetroSystemDetails: async () => {
        details++
        return taipei
      },
    })
    await resolve({ title: 'Walk', startTime: '09:00', endTime: '10:00', tag: 'walk', sections: [] }, 'Тайбэй')
    expect(systems).toBe(0)
    await resolve(activity(), 'Тайбэй')
    await resolve(activity(), 'Тайбэй')
    expect([systems, details]).toEqual([1, 1])
    const warnings: string[] = []
    const failing = createMetroActivityResolver({ listMetroSystems: async () => {
      throw new Error('offline')
    }, getMetroSystemDetails: catalog.getMetroSystemDetails }, message => warnings.push(message))
    expect(await failing(activity(), 'Тайбэй')).toEqual(activity())
    await failing(activity(), 'Тайбэй')
    expect(warnings).toHaveLength(1)
  })
  test('enrichment resolves metro even when the activity has no description', async () => {
    const result = await enrichActivityWithMediaAndLocation(activity(), new Map(), null, null, new Map(), new Map(), { uploadImages: false, geocode: false, locationContext: 'Тайбэй', resolveMetro: createMetroActivityResolver(catalog) })
    expect(metro(result).mode).toBe('city')
  })
  test('Markdown transport goes through parsing and enrichment with stable ride IDs', async () => {
    const markdown = '* **09:00 - 09:30** — Метро:\n```transport\ntype: metro\nroutes:\n  - from: "Ximen (G12)"\n    to: "Beimen (G13)"\n    line: "Songshan–Xindian Line"\n    code: G\n```'
    const parsed = parseActivitiesFromMarkdown(markdown)[0]!
    const result = await enrichActivityWithMediaAndLocation(parsed, new Map(), null, null, new Map(), new Map(), { uploadImages: false, geocode: false, metroCityContext: 'Тайбэй', resolveMetro: createMetroActivityResolver(catalog) })
    expect(metro(result).rides[0]).toMatchObject({ id: metro(parsed).rides[0]!.id, lineId: 'tw-taipei-g', stops: 1 })
  })
})

describe('Kaohsiung and Taichung catalogs', () => {
  const catalog = {
    listMetroSystems: async () => [kaohsiung, taichung].map(({ id, city }) => ({ id, city })),
    getMetroSystemDetails: async (id: string) => id === kaohsiung.id ? kaohsiung : taichung,
  }
  test('maps Kaohsiung station codes and the former Sizihwan name', async () => {
    const result = metro(await createMetroActivityResolver(catalog)(activity({ lineNumber: 'O', startStation: 'Sizihwan (O1)', endStation: 'Formosa Boulevard (O5)' }), 'Kaohsiung'))
    expect(result).toMatchObject({ mode: 'city', systemId: 'tw-kaohsiung' })
    expect(result.rides[0]).toMatchObject({ lineId: 'tw-kaohsiung-o', startStationId: 'tw-kaohsiung-o1', endStationId: 'tw-kaohsiung-o5', stops: 3 })
  })
  test('maps both passenger numeric codes and official source G codes in Taichung', async () => {
    const resolve = createMetroActivityResolver(catalog)
    const numeric = metro(await resolve(activity({ lineNumber: 'G', startStation: 'Wenhua Senior High School (108)', endStation: 'Daqing (115)' }), 'Тайчжун'))
    expect(numeric).toMatchObject({ mode: 'city', systemId: 'tw-taichung' })
    expect(numeric.rides[0]).toMatchObject({ startStationId: 'tw-taichung-108', endStationId: 'tw-taichung-115', stops: 7 })
    const sourceCodes = metro(await resolve(activity({ lineNumber: 'G', startStation: 'G8', endStation: 'G13' }), '臺中'))
    expect(sourceCodes.rides[0]).toMatchObject({ startStationId: 'tw-taichung-108', endStationId: 'tw-taichung-115', stops: 7 })
  })
  test('keeps contradictory names/codes manual instead of choosing Taichung City Hall', async () => {
    const resolve = createMetroActivityResolver(catalog)
    for (const station of ['Daqing (110)', 'Nantun (110)']) {
      const result = metro(await resolve(activity({ lineNumber: 'G', startStation: station, endStation: 'Wenhua Senior High School (108)' }), 'Тайчжун'))
      expect(result.mode).toBe('free')
    }
  })
  test('crosses the Circular Light Rail boundary in one stop', async () => {
    const result = metro(await createMetroActivityResolver(catalog)(activity({ lineNumber: 'C', startStation: 'C37', endStation: 'C1', direction: '' }), '高雄'))
    expect(result.rides[0]).toMatchObject({ lineId: 'tw-kaohsiung-c', stops: 1 })
    expect(result.rides[0]!.direction).toContain('по кольцу')
    const explicit = metro(await createMetroActivityResolver(catalog)(activity({ lineNumber: 'C', startStation: 'C37', endStation: 'C1', direction: 'counterclockwise' }), '高雄'))
    expect(explicit.mode).toBe('free')
  })
})
