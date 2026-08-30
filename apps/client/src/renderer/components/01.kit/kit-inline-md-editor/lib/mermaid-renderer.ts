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
    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    cursor: grab;
  `

  const viewer = document.createElement('div')
  viewer.style.cssText = `
    position: relative; width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  `
  overlay.appendChild(viewer)

  const state = createZoomPanState()

  // Clone the SVG so we don't mess with the original
  const svgView = svgClone.cloneNode(true) as SVGSVGElement
  // Get natural SVG dimensions
  const vb = svgView.viewBox.baseVal
  const svgW = vb ? vb.width : svgView.width.baseVal.value
  const svgH = vb ? vb.height : svgView.height.baseVal.value
  // Calculate initial fit: fill available space while preserving aspect ratio
  const winW = window.innerWidth * 0.9
  const winH = window.innerHeight * 0.9
  const fitScale = Math.min(winW / svgW, winH / svgH, 1.5)
  state.scale = fitScale
  svgView.style.cssText = `
    transform-origin: 0 0;
    transition: none;
    pointer-events: none;
    user-select: none;
  `
  viewer.appendChild(svgView)

  // ── Close button ──
  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = '✕'
  closeBtn.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 10001;
    width: 40px; height: 40px; border-radius: 50%; border: none;
    background: rgba(255,255,255,0.15); color: #fff;
    font-size: 1.3rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
    transition: background 0.2s;
  `
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.25)')
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'rgba(255,255,255,0.15)')
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    document.body.removeChild(overlay)
  })
  overlay.appendChild(closeBtn)

  // ── Zoom controls ──
  const zoomIn = document.createElement('button')
  zoomIn.innerHTML = '＋'
  const zoomOut = document.createElement('button')
  zoomOut.innerHTML = '−'
  const resetBtn = document.createElement('button')
  resetBtn.innerHTML = '⟲'
  const controls = [zoomIn, zoomOut, resetBtn]
  controls.forEach((btn) => {
    btn.style.cssText = `
      width: 36px; height: 36px; border-radius: 50%; border: none;
      background: rgba(255,255,255,0.15); color: #fff;
      font-size: 1.1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px); transition: background 0.2s;
    `
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.25)')
    btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.15)')
  })

  const controlsContainer = document.createElement('div')
  controlsContainer.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 10001; display: flex; gap: 8px;
    background: rgba(0,0,0,0.4); backdrop-filter: blur(6px);
    padding: 6px 10px; border-radius: 999px;
  `
  controlsContainer.appendChild(zoomOut)
  controlsContainer.appendChild(resetBtn)
  controlsContainer.appendChild(zoomIn)
  overlay.appendChild(controlsContainer)

  function applyTransform() {
    svgView.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`
  }

  zoomIn.addEventListener('click', () => {
    state.scale = Math.min(state.scale * 1.3, 8)
    applyTransform()
  })
  zoomOut.addEventListener('click', () => {
    state.scale = Math.max(state.scale / 1.3, 0.2)
    applyTransform()
  })
  resetBtn.addEventListener('click', () => {
    state.scale = 1
    state.translateX = 0
    state.translateY = 0
    applyTransform()
  })

  // ── Mouse wheel zoom ──
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault()
    const rect = viewer.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.85 : 1.18
    const newScale = Math.max(0.2, Math.min(8, state.scale * delta))
    state.translateX = mx - (mx - state.translateX) * (newScale / state.scale)
    state.translateY = my - (my - state.translateY) * (newScale / state.scale)
    state.scale = newScale
    applyTransform()
  }, { passive: false })

  // ── Mouse drag pan ──
  overlay.addEventListener('mousedown', (e) => {
    // Don't start drag on buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON')
      return
    state.isDragging = true
    state.dragStartX = e.clientX
    state.dragStartY = e.clientY
    state.origTranslateX = state.translateX
    state.origTranslateY = state.translateY
    overlay.style.cursor = 'grabbing'
  })

  window.addEventListener('mousemove', (e) => {
    if (!state.isDragging)
      return
    state.translateX = state.origTranslateX + (e.clientX - state.dragStartX)
    state.translateY = state.origTranslateY + (e.clientY - state.dragStartY)
    applyTransform()
  })

  window.addEventListener('mouseup', () => {
    if (state.isDragging) {
      state.isDragging = false
      overlay.style.cursor = 'grab'
    }
  })

  // ── Touch support ──
  let lastTouchDist = 0

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
    }
  }, { passive: true })

  overlay.addEventListener('touchmove', (e) => {
    e.preventDefault()
    if (e.touches.length === 1 && state.isDragging) {
      state.translateX = state.origTranslateX + (e.touches[0].clientX - state.dragStartX)
      state.translateY = state.origTranslateY + (e.touches[0].clientY - state.dragStartY)
      applyTransform()
    }
    else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2

      if (lastTouchDist > 0) {
        const newScale = Math.max(0.2, Math.min(8, state.scale * (dist / lastTouchDist)))
        state.translateX = cx - (cx - state.translateX) * (newScale / state.scale)
        state.translateY = cy - (cy - state.translateY) * (newScale / state.scale)
        state.scale = newScale
        applyTransform()
      }
      lastTouchDist = dist
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
    width: 32px; height: 32px; border-radius: 8px; border: none;
    background: var(--bg-tertiary-color, rgba(0,0,0,0.35));
    color: var(--fg-secondary-color, #ccc);
    font-size: 1.1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s, background 0.2s;
    backdrop-filter: blur(2px);
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
