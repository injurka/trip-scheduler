import { describe, expect, test } from 'bun:test'
import kaohsiung from '../../../tools/metro-import/data/kaohsiung.json'
import taichung from '../../../tools/metro-import/data/taichung.json'
import taipei from '../../../tools/metro-import/data/taipei.json'
import { getMetroGeometry, getMetroRidePath } from '../src/renderer/components/04.features/trip-info/trip-plan/lib/metro-route'

const red = taipei.lines.find(line => line.id === 'tw-taipei-r')!
describe('city metro routes', () => {
  test('counts stops in either direction and excludes the Xinbeitou spur from the main line', () => {
    expect(getMetroRidePath(red, 'tw-taipei-r21', 'tw-taipei-r23')?.stops).toBe(2)
    const reverse = getMetroRidePath(red, 'tw-taipei-r23', 'tw-taipei-r21')!
    expect(reverse.stations.map(s => s.id)).toEqual(['tw-taipei-r23', 'tw-taipei-r22', 'tw-taipei-r21'])
    expect(reverse.direction).toContain('Guangci')
    expect(getMetroRidePath(red, 'tw-taipei-r22a', 'tw-taipei-r21')).toBeNull()
  })
  test('rejects stale, missing or identical station choices', () => {
    expect(getMetroRidePath(red, 'other-city', 'tw-taipei-r21')).toBeNull()
    expect(getMetroRidePath(red, 'tw-taipei-r21', 'tw-taipei-r21')).toBeNull()
    expect(getMetroRidePath(undefined, null, null)).toBeNull()
  })
  test('does not bridge missing coordinates and uses longitude/latitude order', () => {
    expect(getMetroGeometry([{ id: 'a', name: 'a', latitude: 25, longitude: 121 }, { id: 'b', name: 'b' }])).toBeNull()
    expect(getMetroGeometry(red.stations)?.[0]).toEqual([red.stations[0]!.longitude, red.stations[0]!.latitude])
  })
  test('Taipei catalog has six lines, two spurs and both orange destinations, with valid coordinates', () => {
    expect(taipei.lines.length).toBe(9)
    expect(red.stations[0]!.id).toBe('tw-taipei-r01')
    expect(new Set(taipei.lines.flatMap(line => line.stations.map(s => s.id))).size).toBe(136)
    expect(new Set(taipei.lines.map(line => line.lineNumber)).size).toBe(6)

    for (const line of taipei.lines) {
      expect(new Set(line.stations.map(s => s.id)).size).toBe(line.stations.length)
      expect(getMetroGeometry(line.stations)?.length).toBe(line.stations.length)

      for (const station of line.stations) {
        expect(station.latitude).toBeGreaterThan(24.9)
        expect(station.latitude).toBeLessThan(25.3)
        expect(station.longitude).toBeGreaterThan(121.3)
        expect(station.longitude).toBeLessThan(121.7)
      }
    }

    const luzhou = taipei.lines.find(line => line.id === 'tw-taipei-o-luzhou')!
    expect(getMetroRidePath(luzhou, 'tw-taipei-o12', 'tw-taipei-o50')?.stops).toBe(1)
    expect(luzhou.stations.some(s => s.id === 'tw-taipei-o13')).toBe(false)
  })
})

test('Kaohsiung and Taichung catalog completeness and circular paths', () => {
  expect(kaohsiung.lines.map(line => line.stations.length)).toEqual([25, 14, 38])
  expect(taichung.lines[0]!.stations.length).toBe(18)
  const ring = kaohsiung.lines.find(line => line.lineNumber === 'C')!
  expect(getMetroRidePath(ring, 'tw-kaohsiung-c37', 'tw-kaohsiung-c1')?.stops).toBe(1)
  expect(getMetroRidePath(ring, 'tw-kaohsiung-c1', 'tw-kaohsiung-c37')?.stations.map(s => s.id)).toEqual(['tw-kaohsiung-c1', 'tw-kaohsiung-c37'])

  for (const system of [kaohsiung, taichung]) {
    for (const line of system.lines) {
      expect(new Set(line.stations.map(s => s.id)).size).toBe(line.stations.length)
      expect(getMetroGeometry(line.stations)?.length).toBe(line.stations.length)

      for (const station of line.stations) {
        expect(station.latitude).toBeGreaterThan(22.5)
        expect(station.latitude).toBeLessThan(24.3)
        expect(station.longitude).toBeGreaterThan(120.2)
        expect(station.longitude).toBeLessThan(120.8)
      }
    }
  }
})
