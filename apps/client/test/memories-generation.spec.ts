import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GenerateDialog from '../src/renderer/components/04.features/trip-info/trip-memories/ui/dialogs/generate-memories-dialog.vue'

const api = vi.hoisted(() => ({ generate: vi.fn(), applyGenerated: vi.fn() }))
vi.mock('~/plugins/request', () => ({
  useRequest: async (options: { fn: (db: unknown) => Promise<unknown>, onSuccess: (data: unknown) => void, onError: (error: unknown) => void }) => {
    try {
      options.onSuccess(await options.fn({ memories: api }))
    }
    catch {
      options.onError({ error: { customMessage: 'Ошибка сервера' } })
    }
  },
}))
vi.mock('~/components/01.kit/kit-dialog-with-close', () => ({ KitDialogWithClose: { template: '<div><slot /></div>' } }))
vi.mock('~/components/01.kit/kit-btn', () => ({ KitBtn: { template: '<button><slot /></button>' } }))
vi.mock('~/components/01.kit/kit-input', () => ({
  KitInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))
vi.mock('~/components/01.kit/kit-markdown-viewer', () => ({ KitMarkdownViewer: { props: ['markdown'], template: '<div>{{ markdown }}</div>' } }))

const block = {
  type: 'activity',
  targetId: null,
  title: 'Прогулка',
  comment: 'Гуляли у моря.',
  time: '10:00',
  timeEstimated: true,
  tag: 'walk',
}
const dayId = '405a53ea-0ccb-4a64-aaaf-a19103b276af'
beforeEach(() => {
  vi.clearAllMocks()
  api.generate.mockResolvedValue({ blocks: [{ ...block }] })
  api.applyGenerated.mockResolvedValue([])
})

describe('memories generation preview', () => {
  it('generates without saving and applies the edited preview only on confirmation', async () => {
    const wrapper = mount(GenerateDialog, { props: { visible: true, dayId, existing: [] } })
    await wrapper.find('textarea').setValue('Гуляли у моря')
    await wrapper.findAll('button').find(b => b.text().startsWith('OK'))!.trigger('click')
    await flushPromises()
    expect(api.generate).toHaveBeenCalledWith({ dayId, text: 'Гуляли у моря' })
    expect(api.applyGenerated).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Новая активность')
    expect(wrapper.text()).toContain('Время приблизительное')
    await wrapper.findAll('textarea')[2]!.setValue('Гуляли по набережной у моря.')
    await wrapper.findAll('button').find(b => b.text() === 'Добавить изменения')!.trigger('click')
    await flushPromises()
    expect(api.applyGenerated).toHaveBeenCalledWith({ dayId, blocks: [{ ...block, comment: 'Гуляли по набережной у моря.' }] })
    expect(wrapper.emitted('saved')).toEqual([[[]]])
    wrapper.unmount()
  })

  it('retains the preview on save failure and allows retry', async () => {
    api.applyGenerated.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mount(GenerateDialog, { props: { visible: true, dayId, existing: [] } })
    await wrapper.find('textarea').setValue('Рассказ')
    await wrapper.findAll('button').find(b => b.text().startsWith('OK'))!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'Добавить изменения')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Ошибка сервера')
    expect(wrapper.text()).toContain('Новая активность')
    expect(wrapper.emitted('saved')).toBeUndefined()
    await wrapper.findAll('button').find(b => b.text() === 'Добавить изменения')!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('saved')).toBeDefined()
    wrapper.unmount()
  })
})
