import { describe, expect, it } from 'bun:test'
import { tryParseJson } from './json-parser'

describe('json-parser', () => {
  it('parses clean valid JSON', () => {
    const raw = '{"activities": [{"title": "Test"}]}'
    const result = tryParseJson<{ activities: Array<{ title: string }> }>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activities[0].title).toBe('Test')
    }
  })

  it('sanitizes and parses markdown code fence with ```json', () => {
    const raw = '```json\n{\n  "activities": [\n    {"title": "Petronas Towers"}\n  ]\n}\n```'
    const result = tryParseJson<any>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activities[0].title).toBe('Petronas Towers')
    }
  })

  it('sanitizes commentary before and after JSON', () => {
    const raw = 'Here is the requested JSON plan for day 1:\n```json\n{"activities": [{"title": "Kuala Lumpur"}]}\n```\nHope you like it!'
    const result = tryParseJson<any>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activities[0].title).toBe('Kuala Lumpur')
    }
  })

  it('removes trailing commas in arrays and objects', () => {
    const raw = `
    {
      "activities": [
        {
          "title": "Breakfast",
          "tag": "food",
        },
      ],
    }
    `
    const result = tryParseJson<any>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activities[0].title).toBe('Breakfast')
    }
  })

  it('removes comments inside JSON', () => {
    const raw = `
    // This is the generated plan
    {
      /* Multi-line comment */
      "activities": [
        {
          "title": "Batu Caves"
        }
      ]
    }
    `
    const result = tryParseJson<any>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activities[0].title).toBe('Batu Caves')
    }
  })

  it('handles array root structures', () => {
    const raw = '```json\n[{"title": "Item 1"}, {"title": "Item 2"}]\n```'
    const result = tryParseJson<any>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.length).toBe(2)
      expect(result.data[0].title).toBe('Item 1')
    }
  })

  it('fails gracefully on completely broken JSON', () => {
    const raw = 'This is definitely not a JSON { broken'
    const result = tryParseJson<any>(raw)
    expect(result.success).toBe(false)
  })
})
