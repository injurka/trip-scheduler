/**
 * Keyboard-Aware Layout System — чистая геометрия (без DOM-побочек).
 *
 * Разделение обязанностей:
 * 1. Android / WebView сам сообщает о клавиатуре — либо уменьшая visual viewport
 *    (WebView M139+, `interactive-widget=resizes-visual`), либо уменьшая окно целиком
 *    (`adjustResize`, Chrome с `interactive-widget=resizes-content`).
 * 2. Layout: фиксированные шторки/диалоги подстраиваются под CSS-переменные
 *    `--visible-height`, `--visible-top`, `--keyboard-inset-height`.
 * 3. Focus visibility: активное поле прокручивается минимально и только если перекрыто.
 *
 * Мы НЕ измеряем клавиатуру напрямую и НЕ двигаем страницу при каждом фокусе.
 */

export type KeyboardMode = 'none' | 'visual-viewport' | 'resize'

export interface ViewportSnapshot {
  /** `window.innerHeight` — высота layout viewport */
  layoutHeight: number
  /** `visualViewport.height` */
  visualHeight: number
  /** `visualViewport.offsetTop` */
  visualTop: number
  /** `visualViewport.scale` — при pinch-zoom геометрию клавиатуры не считаем */
  scale: number
}

export interface KeyboardGeometryOptions {
  /** Сфокусировано ли поле, вызывающее текстовую клавиатуру */
  editableFocused: boolean
  /** Максимальная высота layout viewport при текущей ширине (без клавиатуры) */
  baselineHeight: number
  /** Минимальное уменьшение, которое считаем клавиатурой, а не панелью браузера */
  threshold?: number
}

export interface KeyboardGeometry {
  /** Реально видимая высота области приложения */
  visibleHeight: number
  /** Смещение видимой области относительно layout viewport */
  visibleTop: number
  /** Насколько клавиатура перекрывает низ layout viewport (только в режиме visual-viewport) */
  keyboardInset: number
  isKeyboardOpen: boolean
  mode: KeyboardMode
}

export const KEYBOARD_THRESHOLD_PX = 120

function detectKeyboardMode(
  inset: number,
  resizedBy: number,
  editableFocused: boolean,
  threshold: number,
): KeyboardMode {
  if (!editableFocused)
    return 'none'

  if (inset > threshold)
    return 'visual-viewport'

  return resizedBy > threshold ? 'resize' : 'none'
}

export function computeKeyboardGeometry(snapshot: ViewportSnapshot, options: KeyboardGeometryOptions): KeyboardGeometry {
  const threshold = options.threshold ?? KEYBOARD_THRESHOLD_PX
  const layoutHeight = Math.max(0, snapshot.layoutHeight)
  const resizedBy = Math.max(0, options.baselineHeight - layoutHeight)
  // Pinch-zoom: visual viewport меньше layout по причине масштаба, а не клавиатуры
  const isZoomed = snapshot.scale > 1.01

  const visualHeight = isZoomed ? layoutHeight : Math.max(0, Math.min(snapshot.visualHeight, layoutHeight))
  const visualTop = isZoomed ? 0 : Math.max(0, snapshot.visualTop)
  const inset = Math.max(0, Math.round(layoutHeight - visualHeight - visualTop))
  const mode = detectKeyboardMode(
    inset,
    resizedBy,
    options.editableFocused,
    threshold,
  )
  const isKeyboardOpen = mode !== 'none'

  return {
    visibleHeight: Math.round(isKeyboardOpen ? visualHeight : layoutHeight),
    visibleTop: Math.round(isKeyboardOpen ? visualTop : 0),
    keyboardInset: mode === 'visual-viewport' ? inset : 0,
    isKeyboardOpen,
    mode,
  }
}

export interface VerticalRange {
  top: number
  bottom: number
}

export interface ScrollState {
  current: number
  max: number
}

/** Минимум видимой части для элементов выше доступной области (длинные textarea, редакторы) */
export const OVERSIZED_MIN_VISIBLE_PX = 64

/**
 * Минимальная прокрутка, нужная чтобы `target` оказался внутри `band`.
 * Аналог `scrollIntoView({ block: 'nearest' })`, но с явной видимой областью
 * (над клавиатурой) и ограничением реальным запасом прокрутки контейнера.
 *
 * Возвращает целое смещение для `scrollBy` (0 — ничего двигать не нужно).
 */
export function computeRevealDelta(target: VerticalRange, band: VerticalRange, scroll: ScrollState): number {
  const bandHeight = band.bottom - band.top

  if (bandHeight <= 0)
    return 0

  const targetHeight = target.bottom - target.top
  let delta = 0

  if (targetHeight > bandHeight) {
    // Поле выше доступной области: достаточно, чтобы заметная его часть была видна
    const visible = Math.min(target.bottom, band.bottom) - Math.max(target.top, band.top)

    if (visible >= Math.min(OVERSIZED_MIN_VISIBLE_PX, bandHeight / 2))
      return 0

    delta = target.top - band.top
  }
  else if (target.bottom > band.bottom) {
    delta = target.bottom - band.bottom
  }
  else if (target.top < band.top) {
    delta = target.top - band.top
  }

  const min = -Math.max(0, scroll.current)
  const max = Math.max(0, scroll.max - scroll.current)
  const clamped = Math.round(Math.min(max, Math.max(min, delta)))

  return Math.abs(clamped) < 1 ? 0 : clamped
}

/** Типы input, которые вызывают текстовую клавиатуру */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

export interface EditableDescriptor {
  tagName: string
  type?: string | null
  readOnly?: boolean
  disabled?: boolean
  isContentEditable?: boolean
  inputMode?: string | null
}

export function isKeyboardEditable(el: EditableDescriptor): boolean {
  if (el.disabled || el.readOnly)
    return false

  if (el.inputMode === 'none')
    return false

  const tag = el.tagName.toUpperCase()

  if (tag === 'TEXTAREA')
    return true

  if (tag === 'INPUT')
    return !NON_TEXT_INPUT_TYPES.has((el.type || 'text').toLowerCase())

  return Boolean(el.isContentEditable)
}
