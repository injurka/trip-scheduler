import type { Memory } from '../src/renderer/shared/types/models/memory'
import { describe, expect, it } from 'vitest'
import { groupMemories } from '../src/renderer/components/04.features/trip-info/trip-memories/lib/group-memories'

function memory(id: string, time: string, patch: Partial<Memory> = {}): Memory {
  return {
    id,
    timestamp: `2026-11-15T${time}:00Z`,
    title: '',
    comment: null,
    imageId: null,
    ...patch,
  } as Memory
}

describe('linked memory notes', () => {
  it('keeps a missed-bus note under the bus activity even before its timestamp and after another activity starts', () => {
    const bus = memory('bus', '09:45', { title: 'Переход к верхней остановке и ожидание автобуса', comment: 'Исходное описание' })
    const walk = memory('walk', '10:00', { title: 'Кедровый лес' })
    const early = memory('early', '09:40', { comment: 'Остановка перенесена, на автобус не успел.', parentMemoryId: 'bus' })
    const late = memory('late', '10:05', { comment: 'Автобус ушёл.', parentMemoryId: 'bus' })
    const groups = groupMemories([early, bus, walk, late])
    expect(groups).toHaveLength(2)
    expect(groups[0].activity).toBe(bus)
    expect(groups[0].memories.map(m => m.id)).toEqual(['bus', 'early', 'late'])
    expect(groups[1].memories).toEqual([])
    expect(bus.title).toBe('Переход к верхней остановке и ожидание автобуса')
    expect(bus.comment).toBe('Исходное описание')
  })
  it('preserves legacy chronological grouping and notes whose parent was deleted', () => {
    const activity = memory('activity', '09:00', { title: 'Прогулка' })
    const note = memory('note', '09:40', { parentMemoryId: null })
    expect(groupMemories([activity, note])[0].memories).toEqual([note])
    expect(groupMemories([note])[0]).toMatchObject({ type: 'start', memories: [note] })
  })
})
