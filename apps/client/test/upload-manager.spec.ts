import type { IProcessingMemory } from '../src/renderer/components/04.features/trip-info/trip-memories/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UploadingIndicator from '../src/renderer/components/04.features/trip-info/trip-memories/ui/processing/uploading-indicator.vue'

function createMockItem(
  id: string,
  name: string,
  status: 'uploading' | 'queued' | 'error',
  progress = 0,
  error?: string,
): IProcessingMemory {
  const file = new File(['mock content'], name, { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: 2.96 * 1024 * 1024 })

  return {
    tempId: id,
    file,
    previewUrl: `blob:mock/${id}`,
    status,
    progress,
    error,
  }
}

describe('uploading-indicator (Unified Upload Manager)', () => {
  it('renders unified manager with statistics for uploading, queued and failed items', () => {
    const memories: IProcessingMemory[] = [
      createMockItem(
        '1',
        'PXL_2026_1108.jpg',
        'uploading',
        73,
      ),
      createMockItem('2', 'queue1.jpg', 'queued'),
      createMockItem('3', 'queue2.jpg', 'queued'),
      createMockItem('4', 'queue3.jpg', 'queued'),
      createMockItem('5', 'queue4.jpg', 'queued'),
      createMockItem('6', 'queue5.jpg', 'queued'),
      createMockItem(
        '7',
        'error1.jpg',
        'error',
        0,
        'Сетевая ошибка',
      ),
    ]

    const wrapper = mount(UploadingIndicator, {
      props: {
        processingMemories: memories,
      },
      global: {
        stubs: {
          KitTooltip: {
            template: '<div class="kit-tooltip"><slot /></div>',
          },
          Icon: {
            template: '<span class="iconify" />',
          },
        },
      },
    })

    // Header badge
    expect(wrapper.text()).toContain('7 файлов')

    // Stats row
    expect(wrapper.find('.stat-col:nth-child(1) .stat-value').text()).toBe('1')
    expect(wrapper.find('.stat-col:nth-child(2) .stat-value').text()).toBe('5')
    expect(wrapper.find('.stat-col:nth-child(3) .stat-value').text()).toBe('1')

    // Active upload section
    expect(wrapper.text()).toContain('PXL_2026_1108.jpg')
    expect(wrapper.text()).toContain('73%')

    // Compact queue section with +1 more button
    expect(wrapper.find('.queue-more-tile').exists()).toBe(true)
    expect(wrapper.find('.queue-more-tile').text()).toContain('+1')

    // Errors section
    expect(wrapper.text()).toContain('Ошибки загрузки · 1')
    expect(wrapper.text()).toContain('error1.jpg')
    expect(wrapper.text()).toContain('Сетевая ошибка')
  })

  it('handles collapsible state properly', async () => {
    const memories: IProcessingMemory[] = [
      createMockItem(
        '1',
        'PXL_2026_1108.jpg',
        'uploading',
        42,
      ),
      createMockItem('2', 'queue1.jpg', 'queued'),
    ]

    const wrapper = mount(UploadingIndicator, {
      props: {
        processingMemories: memories,
      },
      global: {
        stubs: {
          KitTooltip: { template: '<div><slot /></div>' },
          Icon: { template: '<span class="iconify" />' },
        },
      },
    })

    expect(wrapper.find('.expanded-box').exists()).toBe(true)
    expect(wrapper.find('.collapsed-box').exists()).toBe(false)

    // Click collapse button
    await wrapper.find('.collapse-btn').trigger('click')

    expect(wrapper.find('.expanded-box').exists()).toBe(false)
    expect(wrapper.find('.collapsed-box').exists()).toBe(true)
    expect(wrapper.text()).toContain('42% · PXL_2026_1108.jpg')

    // Click expand button to restore
    await wrapper.find('.expand-btn').trigger('click')
    expect(wrapper.find('.expanded-box').exists()).toBe(true)
  })

  it('expands queue when clicking more tile and allows removing queued items', async () => {
    const memories: IProcessingMemory[] = [
      createMockItem('1', 'q1.jpg', 'queued'),
      createMockItem('2', 'q2.jpg', 'queued'),
      createMockItem('3', 'q3.jpg', 'queued'),
      createMockItem('4', 'q4.jpg', 'queued'),
      createMockItem('5', 'q5.jpg', 'queued'),
    ]

    const wrapper = mount(UploadingIndicator, {
      props: {
        processingMemories: memories,
      },
      global: {
        stubs: {
          KitTooltip: { template: '<div><slot /></div>' },
          Icon: { template: '<span class="iconify" />' },
        },
      },
    })

    expect(wrapper.find('.queue-strip').exists()).toBe(true)
    expect(wrapper.find('.queue-expanded-box').exists()).toBe(false)

    // Click +1 tile
    await wrapper.find('.queue-more-tile').trigger('click')

    expect(wrapper.find('.queue-expanded-box').exists()).toBe(true)

    // Click remove on an item
    const removeBtn = wrapper.find('.queue-remove-btn')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual(['1'])
  })

  it('emits retry, retryAll, remove, and cancel actions', async () => {
    const memories: IProcessingMemory[] = [
      createMockItem(
        'u1',
        'active.jpg',
        'uploading',
        50,
      ),
      createMockItem(
        'e1',
        'error1.jpg',
        'error',
        0,
        'Error 1',
      ),
      createMockItem(
        'e2',
        'error2.jpg',
        'error',
        0,
        'Error 2',
      ),
    ]

    const wrapper = mount(UploadingIndicator, {
      props: {
        processingMemories: memories,
      },
      global: {
        stubs: {
          KitTooltip: { template: '<div><slot /></div>' },
          Icon: { template: '<span class="iconify" />' },
        },
      },
    })

    // Cancel active upload
    await wrapper.find('.cancel-btn').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')![0]).toEqual(['u1'])

    // Retry single error item
    await wrapper.find('.action-icon-btn.retry-btn').trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
    expect(wrapper.emitted('retry')![0]).toEqual(['e1'])

    // Remove single error item
    await wrapper.find('.action-icon-btn.remove-btn').trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual(['e1'])

    // Click retry all errors button
    await wrapper.find('.retry-all-btn').trigger('click')
    expect(wrapper.emitted('retryAll')).toBeTruthy()
  })
})
