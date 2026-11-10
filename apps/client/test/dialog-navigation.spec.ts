import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { hasOpenModals, useDialogHistory, waitForDialogHistory } from '../src/renderer/components/01.kit/kit-dialog-with-close/composables/use-dialog-history'

// Memory history cannot reproduce a race with the browser's History API.
describe.each(['web', 'hash'])('navigation from a dialog (%s history)', (mode) => {
  const history = mode === 'hash' ? createWebHashHistory : createWebHistory
  const scopes: ReturnType<typeof effectScope>[] = []

  beforeEach(() => {
    const back = window.history.back.bind(window.history)
    // Browser traversal completes asynchronously; happy-dom otherwise runs it inline.
    vi.spyOn(window.history, 'back').mockImplementation(() => {
      setTimeout(back, 200)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    scopes.splice(0).forEach(scope => scope.stop())
  })

  it.each(['/trip/test?section=notes', '/activity-tracking'])('keeps %s active after closing the menu', async (target) => {
    window.history.replaceState(null, '', '/')
    const routerHistory = history()
    const router = createRouter({
      history: routerHistory,
      routes: [
        { path: '/trip/:id', component: {} },
        { path: '/activity-tracking', component: {} },
      ],
    })
    await router.push('/trip/test')
    const open = ref(false)
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() => useDialogHistory(`menu-${mode}-${target}`, open))
    open.value = true
    await nextTick()
    expect(hasOpenModals()).toBe(true)

    open.value = false
    await waitForDialogHistory()
    await router.push(target)
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(router.currentRoute.value.fullPath).toBe(target)
    expect(window.history.state.isModal).not.toBe(true)
    expect(hasOpenModals()).toBe(false)
    routerHistory.destroy()
  })

  it('waits for every nested menu entry before navigating', async () => {
    window.history.replaceState(null, '', '/')
    const routerHistory = history()
    const router = createRouter({ history: routerHistory, routes: [{ path: '/trip/:id', component: {} }] })
    await router.push('/trip/test')
    const dialogs = [ref(false), ref(false), ref(false)]
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() => dialogs.forEach((open, i) => useDialogHistory(`nested-${mode}-${i}`, open)))

    for (const open of dialogs) {
      open.value = true
      await nextTick()
    }

    dialogs[2].value = false
    await nextTick()
    const cleanup = waitForDialogHistory()
    await nextTick()
    dialogs[1].value = false
    dialogs[0].value = false
    await cleanup
    expect(window.history.state.isModal).not.toBe(true)
    await router.push('/trip/test?section=notes')
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(router.currentRoute.value.fullPath).toBe('/trip/test?section=notes')
    expect(hasOpenModals()).toBe(false)
    routerHistory.destroy()
  })

  it('still closes the menu on system Back without changing the section', async () => {
    window.history.replaceState(null, '', '/')
    const routerHistory = history()
    const router = createRouter({ history: routerHistory, routes: [{ path: '/trip/:id', component: {} }] })
    await router.push('/trip/test?section=notes')
    const open = ref(true)
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() => useDialogHistory(`back-${mode}`, open))
    await nextTick()

    window.history.back()
    await new Promise(resolve => setTimeout(resolve, 300))
    await nextTick()

    expect(open.value).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/trip/test?section=notes')
    expect(hasOpenModals()).toBe(false)
    routerHistory.destroy()
  })
})
