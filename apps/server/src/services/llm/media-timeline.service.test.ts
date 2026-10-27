import { beforeEach, describe, expect, it, mock } from 'bun:test'

const check = mock(async (_userId: string) => {})
const deduct = mock(async (..._args: unknown[]) => {})
const record = mock(async (..._args: unknown[]) => {})
const complete = mock(async (..._args: unknown[]) => ({
  model: 'gemini-3.5-flash-lite',
  usage: { prompt_tokens: 123, completion_tokens: 24 },
  choices: [{ message: { content: '{"groups":[{"id":0,"title":"Прогулка у воды"},{"id":99,"title":"Лишняя группа"}]}' } }],
}))
mock.module('~/services/quota.service', () => ({ quotaService: { checkLlmCreditQuota: check, deductLlmCredits: deduct } }))
mock.module('~/repositories/llm-usage.repository', () => ({ llmUsageRepository: { create: record } }))
mock.module('~/lib/llm', () => ({ AI_MODELS: ['gemini-3.5-flash-lite'], DEFAULT_AI_MODEL: 'gemini-2.5-flash-lite', createAiChatRequest: complete }))
const { describeMediaTimeline, MediaTimelineInputSchema } = await import('./media-timeline.service')
const input = { groups: [{ id: 0, count: 3, frame: 'data:image/jpeg;base64,YQ==' }] }

beforeEach(() => {
  check.mockClear()
  deduct.mockClear()
  record.mockClear()
  complete.mockClear()
})
describe('bounded media timeline AI analysis', () => {
  it('rejects remote image URLs, oversized payloads and more than twelve frames', () => {
    expect(MediaTimelineInputSchema.safeParse({ groups: [{ ...input.groups[0], frame: 'https://example.com/private.jpg' }] }).success).toBe(false)
    expect(MediaTimelineInputSchema.safeParse({ groups: Array.from({ length: 13 }).fill(input.groups[0]) }).success).toBe(false)
    expect(MediaTimelineInputSchema.safeParse({ groups: [{ ...input.groups[0], frame: `data:image/jpeg;base64,${'A'.repeat(180001)}` }] }).success).toBe(false)
  })
  it('uses low-detail frames, caps output, accounts usage and excludes invented groups', async () => {
    const result = await describeMediaTimeline('user', input)
    expect(result.groups).toEqual([{ id: 0, title: 'Прогулка у воды' }])
    expect(check).toHaveBeenCalledWith('user')
    expect(complete.mock.calls[0][1]).toMatchObject({ model: 'gemini-3.5-flash-lite', max_tokens: 1800 })
    expect(complete.mock.calls[0][0]).toMatchObject({ user: [{ type: 'text' }, { type: 'image_url', image_url: { detail: 'low' } }] })
    expect(deduct).toHaveBeenCalledWith('user', 'gemini-3.5-flash-lite', 123, 24)
    expect(record).toHaveBeenCalledTimes(1)
  })
  it('does not contact the model when credits are exhausted', async () => {
    check.mockRejectedValueOnce(new Error('Quota exceeded'))
    await expect(describeMediaTimeline('user', input)).rejects.toThrow('Quota exceeded')
    expect(complete).not.toHaveBeenCalled()
  })
  it('fails safely on invalid output without starting a repair request', async () => {
    complete.mockResolvedValueOnce({ model: 'gemini-3.5-flash-lite', usage: { prompt_tokens: 5, completion_tokens: 2 }, choices: [{ message: { content: '{broken' } }] })
    await expect(describeMediaTimeline('user', input)).rejects.toThrow('Группы по времени сохранены')
    expect(complete).toHaveBeenCalledTimes(1)
    expect(deduct).toHaveBeenCalledTimes(1)
  })
})

describe('complete media timeline titles', () => {
  it('rejects missing and duplicate titles instead of returning partial success', async () => {
    const twoGroups = { groups: [input.groups[0], { ...input.groups[0], id: 1 }] }
    for (const groups of [
      [{ id: 0, title: 'Кафе' }],
      [{ id: 0, title: 'Кафе' }, { id: 0, title: 'Кафе' }],
    ]) {
      complete.mockResolvedValueOnce({ model: 'gemini-3.5-flash-lite', usage: { prompt_tokens: 5, completion_tokens: 2 }, choices: [{ message: { content: JSON.stringify({ groups }) } }] })
      await expect(describeMediaTimeline('user', twoGroups)).rejects.toThrow('неполный набор')
    }
  })
  it('rejects duplicate input ids', () => {
    expect(MediaTimelineInputSchema.safeParse({ groups: [input.groups[0], input.groups[0]] }).success).toBe(false)
  })
})
