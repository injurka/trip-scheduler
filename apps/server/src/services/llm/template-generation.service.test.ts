import { describe, expect, it } from 'bun:test'
import { validateParsedData } from '~/lib/llm/json-parser'
import {
  AiTemplateResponseSchema,
  normalizeActivities,
  normalizeTimeString,
  sanitizeTag,
  VALID_ACTIVITY_TAGS,
} from './template-generation.service'

describe('template-generation.service validation & normalizer', () => {
  it('normalizes time strings correctly', () => {
    expect(normalizeTimeString('8:00')).toBe('08:00')
    expect(normalizeTimeString('0:30')).toBe('00:30')
    expect(normalizeTimeString('14:45')).toBe('14:45')
    expect(normalizeTimeString('')).toBe('00:00')
  })

  it('sanitizes various tags and synonyms to valid enum values', () => {
    expect(sanitizeTag('transport')).toBe('transport')
    expect(sanitizeTag('транспорт')).toBe('transport')
    expect(sanitizeTag('дорога')).toBe('transport')
    expect(sanitizeTag('transfer')).toBe('transport')

    expect(sanitizeTag('еда')).toBe('food')
    expect(sanitizeTag('обед')).toBe('food')
    expect(sanitizeTag('restaurant')).toBe('food')

    expect(sanitizeTag('достопримечательность')).toBe('attraction')
    expect(sanitizeTag('nature')).toBe('attraction')
    expect(sanitizeTag('sightseeing')).toBe('attraction')
    expect(sanitizeTag('музей')).toBe('attraction')

    expect(sanitizeTag('отдых')).toBe('relax')
    expect(sanitizeTag('hotel')).toBe('relax')

    expect(sanitizeTag('активность')).toBe('activity')
    expect(sanitizeTag('экскурсия')).toBe('activity')
    expect(sanitizeTag('unknown_hallucinated_tag')).toBe('activity')
  })

  it('validates correct activities output against AiTemplateResponseSchema', () => {
    const validOutput = {
      activities: [
        {
          id: '2c32ac8e-6cd5-4c81-b565-ecf61337f1be',
          startTime: '07:30',
          endTime: '08:00',
          title: 'Ранний выезд',
          tag: 'transport',
          sections: [
            {
              id: '405a53ea-0ccb-4a64-aaaf-a19103b276af',
              type: 'description',
              text: 'Описание дороги',
            },
          ],
        },
      ],
    }

    const result = AiTemplateResponseSchema.safeParse(validOutput)
    expect(result.success).toBe(true)
  })

  it('catches invalid tags and bad time format with AiTemplateResponseSchema', () => {
    const invalidOutput = {
      activities: [
        {
          id: '2c32ac8e-6cd5-4c81-b565-ecf61337f1be',
          startTime: '7:30', // invalid HH:mm format
          endTime: '08:00',
          title: 'Ранний выезд',
          tag: 'nature', // invalid tag
        },
      ],
    }

    const validation = validateParsedData(invalidOutput, { schema: AiTemplateResponseSchema })
    expect(validation.success).toBe(false)
    expect(validation.errors).toBeDefined()
    const errorString = validation.errors?.join(' ') || ''
    expect(errorString).toContain('startTime')
    expect(errorString).toContain('tag')
  })

  it('normalizes activities and guarantees all tags and times are valid', () => {
    const rawActivities = [
      {
        startTime: '7:30',
        endTime: '8:00',
        title: 'Утренняя прогулка',
        tag: 'nature',
      },
      {
        startTime: '12:00',
        endTime: '13:00',
        title: 'Обед в Териберке',
        tag: 'еда',
      },
    ]

    const normalized = normalizeActivities(rawActivities)
    expect(normalized.length).toBe(2)

    expect(normalized[0].startTime).toBe('07:30')
    expect(normalized[0].endTime).toBe('08:00')
    expect(VALID_ACTIVITY_TAGS.includes(normalized[0].tag)).toBe(true)
    expect(normalized[0].tag).toBe('attraction')
    expect(normalized[0].id).toBeDefined()

    expect(normalized[1].tag).toBe('food')
    expect(normalized[1].id).toBeDefined()
  })
})
