import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OfflineStatus from '../src/renderer/components/02.shared/offline-banner/ui/offline-banner.vue'
import { useDataTimestamp } from '../src/renderer/shared/composables/use-data-timestamp'
import { setForcedOffline } from '../src/renderer/shared/lib/connectivity'

vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))

let wrapper: ReturnType<typeof mount>

beforeEach(() => {
  window.dispatchEvent(new Event('online'))
  setForcedOffline(false)
  useDataTimestamp().lastDataTimestamp.value = null
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

async function openDetails() {
  await wrapper.get('button').trigger('click')
  await flushPromises()
  await nextTick()
}

describe('offline status', () => {
  it('does not render while online', () => {
    wrapper = mount(OfflineStatus)
    expect(wrapper.find('.offline-status').exists()).toBe(false)
  })

  it('shows a compact status and keeps cache details out of the header until opened', async () => {
    setForcedOffline(true)
    useDataTimestamp().lastDataTimestamp.value = new Date('2026-11-14T10:30:00').getTime()
    wrapper = mount(OfflineStatus, { attachTo: document.body })
    expect(wrapper.text()).toBe('Офлайн')
    expect(document.body.textContent).not.toContain('Последнее обновление')
    expect(wrapper.get('button').attributes('aria-label')).toContain('Офлайн-режим включён')
    await openDetails()
    expect(document.body.textContent).toContain('Режим чтения')
    expect(document.body.textContent).toContain('Последнее обновление:')
    expect(document.body.textContent).toContain('10:30')
  })

  it('can leave forced offline mode without navigating or reloading', async () => {
    setForcedOffline(true)
    wrapper = mount(OfflineStatus, { attachTo: document.body })
    await openDetails()
    const action = document.querySelector<HTMLElement>('[role="menuitem"]')!
    expect(action.textContent).toContain('Выключить офлайн-режим')
    action.click()
    await flushPromises()
    expect(wrapper.find('.offline-status').exists()).toBe(false)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('does not offer a misleading reconnect button when the physical network is unavailable', async () => {
    window.dispatchEvent(new Event('offline'))
    wrapper = mount(OfflineStatus, { attachTo: document.body })
    expect(wrapper.get('button').attributes('aria-label')).toContain('Нет подключения к сети')
    await openDetails()
    expect(document.body.textContent).toContain('Показаны данные из кеша')
    expect(document.querySelector('[role="menuitem"]')).toBeNull()
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(wrapper.find('.offline-status').exists()).toBe(false)
  })

  it('keeps the offline indication if forced mode is disabled while still disconnected', async () => {
    setForcedOffline(true)
    window.dispatchEvent(new Event('offline'))
    wrapper = mount(OfflineStatus, { attachTo: document.body })
    await openDetails()
    document.querySelector<HTMLElement>('[role="menuitem"]')!.click()
    await flushPromises()
    expect(wrapper.get('button').attributes('aria-label')).toContain('Нет подключения к сети')
  })
})
