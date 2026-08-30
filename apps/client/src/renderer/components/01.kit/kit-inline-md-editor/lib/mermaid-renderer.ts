import mermaid from 'mermaid'

let isInitialized = false

/**
 * Read a CSS custom property from :root or the document body.
 * Falls back to the given default if the property isn't set.
 */
function cssProp(name: string, fallback: string): string {
  if (typeof document === 'undefined')
    return fallback
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return val || fallback
}

function getThemeVariables() {
  const bg = cssProp('--bg-primary-color', '#1e1f20')
  const fg = cssProp('--fg-primary-color', '#e4e4e4')
  const fgSecondary = cssProp('--fg-secondary-color', '#e4e4e4cc')
  const accent = cssProp('--fg-accent-color', '#ff8856')
  const border = cssProp('--border-primary-color', '#353535')
  const surface = cssProp('--bg-secondary-color', '#121314')
  const surfaceLow = cssProp('--bg-tertiary-color', '#151617')

  const isDark = Number.parseInt(bg.replace('#', ''), 16) < 0x444444

  return {
    darkMode: isDark,
    background: bg,
    primaryColor: accent,
    primaryTextColor: fg,
    primaryBorderColor: border,
    lineColor: accent,
    secondaryColor: surface,
    secondaryTextColor: fgSecondary,
    secondaryBorderColor: border,
    tertiaryColor: surfaceLow,
    tertiaryTextColor: fgSecondary,
    tertiaryBorderColor: border,
    edgeLabelBackground: surface,
    clusterBkg: surfaceLow,
    clusterBorder: border,
    titleColor: fg,
    nodeTextColor: fg,
    attributeBackgroundColorEven: surface,
    attributeBackgroundColorOdd: surfaceLow,
  }
}

function initMermaid() {
  if (isInitialized)
    return
  isInitialized = true
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: getThemeVariables(),
    securityLevel: 'loose',
    fontFamily: 'Rubik, sans-serif',
  })
}

/**
 * Re-initialize mermaid with fresh theme variables.
 * Call this when the app theme (light ⇄ dark) switches.
 */
export function updateMermaidTheme() {
  if (!isInitialized)
    return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: getThemeVariables(),
    securityLevel: 'loose',
    fontFamily: 'Rubik, sans-serif',
  })
}

export async function renderMermaidDiagram(code: string, id: string): Promise<string> {
  initMermaid()
  try {
    const cleanCode = code.trim()
    if (!cleanCode)
      return ''

    // Re-apply theme variables on each render so theme changes take effect
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: getThemeVariables(),
      securityLevel: 'loose',
      fontFamily: 'Rubik, sans-serif',
    })

    const { svg } = await mermaid.render(id, cleanCode)
    return svg
  }
  catch (err) {
    console.warn('Mermaid render error:', err)
    return ''
  }
}

// ── Theme change watcher ──────────────────────────────────────────
// When data-theme changes on <html>, re-render all visible mermaid
// diagrams so they pick up the new CSS custom property values.
let themeObserver: MutationObserver | null = null

function startMermaidThemeWatcher() {
  if (typeof document === 'undefined' || themeObserver)
    return
  themeObserver = new MutationObserver(() => {
    updateMermaidTheme()
    // Trigger re-render on every visible .mermaid-diagram container
    document.querySelectorAll<HTMLElement>('.mermaid-diagram').forEach((el) => {
      // Find the sibling <pre> that holds the raw code
      const container = el.closest<HTMLElement>('.milkdown-mermaid-container')
      if (!container)
        return
      const pre = container.querySelector<HTMLElement>('.mermaid-raw-code')
      if (!pre || !pre.textContent)
        return
      // Re-render by triggering the editor's update mechanism.
      // Dispatch a custom event that the mermaidView can pick up.
      container.dispatchEvent(new CustomEvent('mermaid-theme-change'))
    })
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
}

// Auto-start on first import (client-side only)
if (typeof document !== 'undefined') {
  // Defer to avoid racing with Vue theme plugin init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMermaidThemeWatcher)
  }
  else {
    startMermaidThemeWatcher()
  }
}

// ── Fullscreen diagram viewer with zoom/pan ──────────────────────

interface ZoomPanState {
  scale: number
  translateX: number
  translateY: number
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  origTranslateX: number
  origTranslateY: number
}

function createZoomPanState(): ZoomPanState {
  return { scale: 1, translateX: 0, translateY: 0, isDragging: false, dragStartX: 0, dragStartY: 0, origTranslateX: 0, origTranslateY: 0 }
}

function setupFullscreenOverlay(svgClone: SVGSVGElement) {
  const overlay = document.createElement('div')
  overlay.className = 'mermaid-fullscreen-overlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background-color: var(--bg-primary-color);
    background-image: radial-gradient(var(--border-primary-color) 1.25px, transparent 1.25px);
    background-size: 24px 24px;
    display: flex; align-items: center; justify-content: center;
    cursor: grab;
    user-select: none;
  `

  const viewer = document.createElement('div')
  viewer.style.cssText = `
    position: relative; width: 100vw; height: 100vh;
    overflow: hidden;
  `
  overlay.appendChild(viewer)

  const state = createZoomPanState()

  // Clone the SVG so we don't mess with the original
  const svgView = svgClone.cloneNode(true) as SVGSVGElement
  // Get natural SVG dimensions
  const vb = svgView.viewBox?.baseVal
  const svgW = (vb && vb.width > 0) ? vb.width : (svgView.width?.baseVal?.value || 800)
  const svgH = (vb && vb.height > 0) ? vb.height : (svgView.height?.baseVal?.value || 600)

  // Calculate initial fit: fill available space while preserving aspect ratio
  const winW = window.innerWidth * 0.85
  const winH = window.innerHeight * 0.85
  const fitScale = Math.min(winW / svgW, winH / svgH, 1.5)
  state.scale = fitScale
  state.translateX = (window.innerWidth - svgW * fitScale) / 2
  state.translateY = (window.innerHeight - svgH * fitScale) / 2

  svgView.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    transition: none;
    pointer-events: none;
    user-select: none;
    will-change: transform;
  `
  viewer.appendChild(svgView)

  function applyTransform() {
    svgView.style.transform = `translate3d(${state.translateX}px, ${state.translateY}px, 0) scale(${state.scale})`
  }

  applyTransform()

  function zoomAt(cx: number, cy: number, factor: number) {
    const newScale = Math.max(0.1, Math.min(10, state.scale * factor))
    state.translateX = cx - (cx - state.translateX) * (newScale / state.scale)
    state.translateY = cy - (cy - state.translateY) * (newScale / state.scale)
    state.scale = newScale
    applyTransform()
  }

  // ── Cleanup & Close handler ──
  const onMouseMove = (e: MouseEvent) => {
    if (!state.isDragging)
      return
    state.translateX = state.origTranslateX + (e.clientX - state.dragStartX)
    state.translateY = state.origTranslateY + (e.clientY - state.dragStartY)
    applyTransform()
  }

  const onMouseUp = () => {
    if (state.isDragging) {
      state.isDragging = false
      overlay.style.cursor = 'grab'
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeOverlay()
    }
  }

  function closeOverlay() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }
  }

  // ── Close button ──
  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = '✕'
  closeBtn.title = 'Закрыть (Esc)'
  closeBtn.setAttribute('aria-label', 'Закрыть')
  closeBtn.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 10001;
    width: 40px; height: 40px; border-radius: 50%;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-secondary-color);
    color: var(--fg-primary-color);
    font-size: 1.2rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transition: background 0.2s, border-color 0.2s, transform 0.1s;
  `
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'var(--bg-tertiary-color)'
    closeBtn.style.borderColor = 'var(--border-primary-color)'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'var(--bg-secondary-color)'
    closeBtn.style.borderColor = 'var(--border-secondary-color)'
  })
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    closeOverlay()
  })
  overlay.appendChild(closeBtn)

  // ── Zoom controls ──
  const zoomIn = document.createElement('button')
  zoomIn.innerHTML = '＋'
  zoomIn.title = 'Приблизить'
  zoomIn.setAttribute('aria-label', 'Приблизить')

  const zoomOut = document.createElement('button')
  zoomOut.innerHTML = '−'
  zoomOut.title = 'Отдалить'
  zoomOut.setAttribute('aria-label', 'Отдалить')

  const resetBtn = document.createElement('button')
  resetBtn.innerHTML = '⟲'
  resetBtn.title = 'Сбросить масштаб'
  resetBtn.setAttribute('aria-label', 'Сбросить масштаб')

  const controls = [zoomOut, resetBtn, zoomIn]
  controls.forEach((btn) => {
    btn.style.cssText = `
      width: 36px; height: 36px; border-radius: 50%; border: none;
      background: transparent; color: var(--fg-primary-color);
      font-size: 1.1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, transform 0.1s;
    `
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'var(--bg-tertiary-color)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent'
    })
  })

  const controlsContainer = document.createElement('div')
  controlsContainer.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 10001; display: flex; gap: 6px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 6px 8px; border-radius: 999px;
  `
  controlsContainer.appendChild(zoomOut)
  controlsContainer.appendChild(resetBtn)
  controlsContainer.appendChild(zoomIn)
  overlay.appendChild(controlsContainer)

  zoomIn.addEventListener('click', () => {
    zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.3)
  })
  zoomOut.addEventListener('click', () => {
    zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.3)
  })
  resetBtn.addEventListener('click', () => {
    state.scale = fitScale
    state.translateX = (window.innerWidth - svgW * fitScale) / 2
    state.translateY = (window.innerHeight - svgH * fitScale) / 2
    applyTransform()
  })

  // ── Mouse wheel zoom ──
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.85 : 1.18
    zoomAt(e.clientX, e.clientY, factor)
  }, { passive: false })

  // ── Mouse drag pan ──
  overlay.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button'))
      return
    state.isDragging = true
    state.dragStartX = e.clientX
    state.dragStartY = e.clientY
    state.origTranslateX = state.translateX
    state.origTranslateY = state.translateY
    overlay.style.cursor = 'grabbing'
  })

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)

  // ── Touch support ──
  let lastTouchDist = 0
  let lastTouchCenterX = 0
  let lastTouchCenterY = 0

  overlay.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      state.isDragging = true
      state.dragStartX = e.touches[0].clientX
      state.dragStartY = e.touches[0].clientY
      state.origTranslateX = state.translateX
      state.origTranslateY = state.translateY
    }
    else if (e.touches.length === 2) {
      state.isDragging = false
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDist = Math.sqrt(dx * dx + dy * dy)
      lastTouchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      lastTouchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2
    }
  }, { passive: true })

  overlay.addEventListener('touchmove', (e) => {
    e.preventDefault()
    if (e.touches.length === 1 && state.isDragging) {
      state.translateX = state.origTranslateX + (e.touches[0].clientX - state.dragStartX)
      state.translateY = state.origTranslateY + (e.touches[0].clientY - state.dragStartY)
      applyTransform()
    }
    else if (e.touches.length === 2 && lastTouchDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2

      const factor = dist / lastTouchDist
      const newScale = Math.max(0.1, Math.min(10, state.scale * factor))
      state.translateX = cx - (cx - state.translateX) * (newScale / state.scale) + (cx - lastTouchCenterX)
      state.translateY = cy - (cy - state.translateY) * (newScale / state.scale) + (cy - lastTouchCenterY)
      state.scale = newScale
      lastTouchDist = dist
      lastTouchCenterX = cx
      lastTouchCenterY = cy
      applyTransform()
    }
  }, { passive: false })

  overlay.addEventListener('touchend', () => {
    state.isDragging = false
    lastTouchDist = 0
  }, { passive: true })

  document.body.appendChild(overlay)
}

export function addFullscreenButton(container: HTMLElement, getSvg: () => SVGSVGElement | null) {
  const btn = document.createElement('button')
  btn.className = 'mermaid-fullscreen-btn'
  btn.innerHTML = '⛶'
  btn.title = 'Открыть на весь экран'
  btn.style.cssText = `
    position: absolute; right: 8px; bottom: 8px; z-index: 10;
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--border-secondary-color, rgba(255,255,255,0.1));
    background: var(--bg-tertiary-color, rgba(0,0,0,0.35));
    color: var(--fg-secondary-color, #ccc);
    font-size: 1.1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s, background 0.2s, border-color 0.2s;
  `
  container.style.position = 'relative'
  container.appendChild(btn)

  container.addEventListener('mouseenter', () => btn.style.opacity = '1')
  container.addEventListener('mouseleave', () => {
    if (!btn.dataset.keep)
      btn.style.opacity = '0'
  })
  btn.addEventListener('mouseenter', () => {
    btn.dataset.keep = '1'
    btn.style.opacity = '1'
  })
  btn.addEventListener('mouseleave', () => {
    delete btn.dataset.keep
    btn.style.opacity = '0'
  })

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const svg = getSvg()
    if (svg)
      setupFullscreenOverlay(svg)
  })
}
