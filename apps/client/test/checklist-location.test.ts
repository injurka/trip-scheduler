import { describe, expect, it } from 'bun:test'
import { checklistDescription, checklistMapCoords, isChecklistMapUrl } from '../src/renderer/components/04.features/trip-info/trip-sections/checklist-section/lib/location'

describe('checklist map presentation', () => {
  it('recognizes map resources without hiding normal websites', () => {
    expect(isChecklistMapUrl('https://www.google.com/maps?q=24,120')).toBe(true)
    expect(isChecklistMapUrl('https://maps.app.goo.gl/example')).toBe(true)
    expect(isChecklistMapUrl('https://www.openstreetmap.org/node/123')).toBe(true)
    expect(isChecklistMapUrl('https://example.com/menu')).toBe(false)
    expect(isChecklistMapUrl('https://www.google.com/search?q=coffee')).toBe(false)
  })

  it('cleans legacy duplicate map metadata while keeping advice and website links', () => {
    const text = '*Локация:* [Coffee](https://www.google.com/maps?q=24,120)\n*Совет:* [Coffee](https://www.google.com/maps?q=24,120), заказать фильтр\n[Меню](https://example.com/menu)'
    expect(checklistDescription(text)).toBe('*Совет:* Coffee, заказать фильтр\n[Меню](https://example.com/menu)')
  })

  it('opens legacy coordinate links at their exact point, including zero coordinates', () => {
    expect(checklistMapCoords('https://www.google.com/maps?q=24.155,120.657')).toEqual({ lat: 24.155, lon: 120.657 })
    expect(checklistMapCoords('https://www.google.com/maps?q=0,0')).toEqual({ lat: 0, lon: 0 })
    expect(checklistMapCoords('https://www.google.com/maps?q=100,200')).toBeUndefined()
    expect(checklistMapCoords('https://example.com/?q=24,120')).toBeUndefined()
  })
})
