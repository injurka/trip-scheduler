/** Reserve actual navigation/playback space, including a pending-corrections row. */
export function observeTrackPopupLayout(host: HTMLElement): () => void {
  const frame = host.parentElement

  if (!frame)
    return () => {}

  let scheduled = 0
  const observed = new Set<Element>()
  const resize = new ResizeObserver(schedule)
  const mutations = new MutationObserver(schedule)
  function update() {
    scheduled = 0
    const nav = frame!.querySelector('.top-nav-bar')
    const panel = frame!.querySelector('.memories-panel')
    const targets = [host, nav, panel].filter((e): e is Element => !!e)

    for (const element of observed) {
      if (!targets.includes(element)) {
        resize.unobserve(element)
        observed.delete(element)
      }
    }

    for (const element of targets) {
      if (!observed.has(element)) {
        resize.observe(element)
        observed.add(element)
      }
    }

    const map = host.getBoundingClientRect()

    if (map.height < 1)
      return

    const top = Math.max(8, (nav?.getBoundingClientRect().bottom ?? map.top) - map.top + 8)
    const bottom = Math.min(map.height - 8, (panel?.getBoundingClientRect().top ?? map.bottom) - map.top - 8)
    host.style.setProperty('--track-point-popup-top', `${top}px`)
    host.style.setProperty('--track-point-popup-height', `${Math.max(1, bottom - top)}px`)
  }
  function schedule() {
    if (!scheduled)
      scheduled = requestAnimationFrame(update)
  }
  mutations.observe(frame, { childList: true, subtree: true })
  update()

  return () => {
    cancelAnimationFrame(scheduled)
    mutations.disconnect()
    resize.disconnect()
  }
}
