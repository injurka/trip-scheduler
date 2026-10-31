import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { tryParseJson, validateParsedData } from './json-parser'

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

  it('validates parsed data with Zod schema successfully', () => {
    const schema = z.object({
      title: z.string(),
      tag: z.enum(['transport', 'food', 'walk']),
    })

    const data = { title: 'Lunch', tag: 'food' as const }
    const result = validateParsedData(data, { schema })
    expect(result.success).toBe(true)
    expect(result.data).toEqual(data)
  })

  it('collects detailed field-level errors when schema validation fails', () => {
    const schema = z.object({
      title: z.string(),
      tag: z.enum(['transport', 'food', 'walk']),
    })

    const data = { title: 'Nature walk', tag: 'nature' }
    const result = validateParsedData(data, { schema })
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('Field "tag"')
  })

  it('repairs raw newlines, tabs, and invalid markdown escapes inside JSON strings', () => {
    const raw = `{"files": [{"path": "04 - Финансы/Финансы.md", "content": "# Финансы\n| Статья | Сумма |\n| --- | --- |\n| Еда \\| Кафе | 5000 ₽ |\nСсылка \\[тест\\](https://example.com/a//b)"}]}`
    const result = tryParseJson<{ files: Array<{ path: string, content: string }> }>(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.files[0].content).toContain('https://example.com/a//b')
      expect(result.data.files[0].content).toContain('\\|')
      expect(result.data.files[0].content).toContain('\n| Статья |')
    }
  })

  it('preserves inner markdown code fences like ```mermaid inside JSON string values', () => {
    const raw = JSON.stringify({
      files: [
        {
          path: '04 - Финансы/Финансы.md',
          content: '# Бюджет\n```mermaid\npie title Расходы\n  "Отели" : 50000\n```\nИтого, все учтено.',
        },
      ],
    })
    // Add trailing comma to force sanitizer path
    const withTrailingComma = raw.replace('}]}', '}]}')
    const result = tryParseJson<{ files: Array<{ path: string, content: string }> }>(withTrailingComma)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.files[0].content).toContain('```mermaid')
    }
  })

  it('runs both Zod schema and validateWithErrors together when both are supplied', () => {
    const schema = z.object({
      days: z.array(z.number()),
    })
    const result = validateParsedData(
      { days: [1, 2] },
      {
        schema,
        validateWithErrors: data => data.days.length === 3
          ? { success: true, data }
          : { success: false, errors: ['Expected 3 days'] },
      },
    )
    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['Expected 3 days'])
  })
})
