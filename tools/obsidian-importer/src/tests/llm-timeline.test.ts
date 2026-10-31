import { expect, it } from 'bun:test'
import { mergeLlmActivitiesWithRawMarkdown } from '../lib/llm'
import { parseActivitiesFromMarkdown } from '../parsers/activity'

it('preserves explicit Markdown times and does not append LLM alternatives', () => {
  const raw = parseActivitiesFromMarkdown('* **07:20 - 08:29** — TRA 自強 101 до Гаосюна (отпр. 07:47):\n    * Плановый интервал с запасом.\n* **08:29 - 09:00** — Трансфер к причалу:\n    * Пешком.')
  const generated = [
    { title: 'Поезд TRA до Гаосюна', startTime: '07:30', endTime: '08:29', tag: 'transport' as const },
    { title: 'Дополнительное событие', startTime: '08:00', endTime: '09:00', tag: 'activity' as const },
  ]
  const merged = mergeLlmActivitiesWithRawMarkdown(generated, raw)
  expect(merged.map(a => [a.startTime, a.endTime, a.title])).toEqual(raw.map(a => [a.startTime, a.endTime, a.title]))
  expect(merged).toHaveLength(2)
})

it('retains LLM generation when a note has no explicit timeline', () => {
  const generated = [{ title: 'Walk', startTime: '10:00', endTime: '11:00', tag: 'walk' as const }]
  expect(mergeLlmActivitiesWithRawMarkdown(generated, [])).toEqual(generated)
})
