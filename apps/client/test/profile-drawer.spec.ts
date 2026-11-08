import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { KitSwitch } from '../src/renderer/components/01.kit/kit-switch'
import ProfileDrawer from '../src/renderer/components/02.shared/profile-drawer/ui/profile-drawer.vue'

vi.mock('~/components/01.kit/kit-avatar', () => ({
  KitAvatar: defineComponent({
    props: ['src', 'name', 'size'],
    render() {
      return h('div', { class: 'mock-avatar' })
    },
  }),
}))

vi.mock('~/components/01.kit/kit-divider', () => ({
  KitDivider: defineComponent({
    render() {
      return h('hr', { class: 'mock-divider' })
    },
  }),
}))

vi.mock('~/components/01.kit/kit-drawer', () => ({
  KitDrawer: defineComponent({
    props: ['open', 'side'],
    emits: ['update:open'],
    render() {
      return h('div', { class: 'mock-drawer' }, this.$slots.default?.())
    },
  }),
}))

vi.mock('~/components/02.shared/offline-manager', () => ({
  OfflineManagerDialog: defineComponent({
    props: ['visible'],
    render() {
      return null
    },
  }),
}))

vi.mock('~/components/02.shared/status-editor-dialog', () => ({
  StatusEditorDialog: defineComponent({
    props: ['visible'],
    render() {
      return null
    },
  }),
}))

vi.mock('~/components/02.shared/user-quota-widget', () => ({
  UserQuotaWidget: defineComponent({
    props: ['title', 'icon', 'current', 'limit', 'unit', 'to'],
    render() {
      return h('div', { class: 'mock-quota' })
    },
  }),
}))

const mockForcedOffline = ref(false)
const mockSetForcedOffline = vi.fn((val: boolean) => {
  mockForcedOffline.value = val
})

vi.mock('~/shared/lib/connectivity', () => ({
  useConnectivity: () => ({
    forcedOffline: mockForcedOffline,
    setForcedOffline: mockSetForcedOffline,
  }),
}))

vi.mock('~/shared/constants/routes', () => ({
  AppRouteNames: {
    UserProfile: 'user-profile',
    TripList: 'trip-list',
    ActivityTracking: 'activity-tracking',
    UserSettings: 'user-settings',
    UsefulLinks: 'useful-links',
    UserQuota: 'user-quota',
    UserStorage: 'user-storage',
  },
  AppRoutePaths: {
    Auth: {
      SignIn: '/auth/sign-in',
    },
  },
}))

describe('kitSwitch UI Component', () => {
  it('renders correctly and toggles value on click', async () => {
    const checked = ref(false)
    const wrapper = mount(KitSwitch, {
      props: {
        'modelValue': checked.value,
        'onUpdate:modelValue': (val: boolean) => {
          checked.value = val
        },
      },
    })

    const root = wrapper.find('button')
    expect(root.exists()).toBe(true)
    expect(root.attributes('data-state')).toBe('unchecked')

    await root.trigger('click')
    expect(checked.value).toBe(true)
  })

  it('respects disabled prop', async () => {
    const checked = ref(false)
    const wrapper = mount(KitSwitch, {
      props: {
        disabled: true,
        modelValue: checked.value,
      },
    })

    const root = wrapper.find('button')
    expect(root.attributes('disabled')).toBeDefined()
  })
})

describe('profileDrawer Navigation Layout', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => null } }],
    })
    mockForcedOffline.value = false
    mockSetForcedOffline.mockClear()
  })

  afterEach(() => {
    mockForcedOffline.value = false
  })

  it('renders offline toggle inside the pinned footer below the scrollable body', () => {
    const wrapper = mount(ProfileDrawer, {
      props: {
        open: true,
      },
      global: {
        plugins: [router],
      },
    })

    // Old offline control in upper menu must NOT exist
    expect(wrapper.find('.offline-mode-control').exists()).toBe(false)

    // Pinned footer exists
    const footer = wrapper.find('.profile-drawer-footer')
    expect(footer.exists()).toBe(true)

    // Scrollable body exists
    const body = wrapper.find('.profile-drawer-body')
    expect(body.exists()).toBe(true)

    // Toggle row is inside footer
    const toggleRow = footer.find('.offline-toggle-row')
    expect(toggleRow.exists()).toBe(true)
    expect(footer.text()).toContain('Принудительный офлайн')
  })

  it('displays dynamic status "Автоматический режим" when offline mode is false', () => {
    mockForcedOffline.value = false

    const wrapper = mount(ProfileDrawer, {
      props: {
        open: true,
      },
      global: {
        plugins: [router],
      },
    })

    const statusText = wrapper.find('.offline-toggle-status')
    expect(statusText.text()).toBe('Автоматический режим')
    expect(wrapper.find('.offline-toggle-row').classes()).not.toContain('is-offline')
  })

  it('displays dynamic status "Только локальные данные" when offline mode is true', async () => {
    mockForcedOffline.value = true

    const wrapper = mount(ProfileDrawer, {
      props: {
        open: true,
      },
      global: {
        plugins: [router],
      },
    })

    const statusText = wrapper.find('.offline-toggle-status')
    expect(statusText.text()).toBe('Только локальные данные')
    expect(wrapper.find('.offline-toggle-row').classes()).toContain('is-offline')
  })

  it('clicking offline-toggle-row toggles forced offline mode', async () => {
    mockForcedOffline.value = false

    const wrapper = mount(ProfileDrawer, {
      props: {
        open: true,
      },
      global: {
        plugins: [router],
      },
    })

    const toggleRow = wrapper.find('.offline-toggle-row')
    await toggleRow.trigger('click')

    expect(mockSetForcedOffline).toHaveBeenCalledWith(true)
  })
})
