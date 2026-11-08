import type { EditableDescriptor, VerticalRange } from '~/shared/lib/keyboard-aware'
import { computeKeyboardGeometry, computeRevealDelta, isKeyboardEditable } from '~/shared/lib/keyboard-aware'

/**
 * Keyboard-Aware Layout System (KeyboardViewportManager + FocusVisibilityManager).
 *
 * Подключается ОДИН раз в корне приложения (`app.vue`). Делает две вещи:
 *
 * 1. Публикует на `<html>` геометрию реально видимой области:
 *    - `--visible-height`        — высота видимой области над клавиатурой;
 *    - `--visible-top`           — смещение visual viewport (если браузер его сдвинул);
 *    - `--keyboard-inset-height` — насколько клавиатура перекрывает низ layout viewport;
 *    - класс `is-keyboard-open`  — пока открыта экранная клавиатура.
 *    Фиксированные шторки/диалоги из `01.kit` используют эти переменные и сжимаются
 *    до видимой области, вместо того чтобы прятаться под клавиатурой.
 *
 * 2. Следит, чтобы активное поле было видно: при фокусе и при уменьшении видимой
 *    области прокручивает ближайшие scroll-контейнеры ровно настолько, насколько нужно.
 *    Если поле уже видно — ничего не двигается. На пользовательскую прокрутку не реагирует.
 *
 * Отключить автопрокрутку для поддерева: `data-keyboard-aware="off"`.
 * Настроить отступы: стандартные `scroll-margin-*` у поля и `scroll-padding-*` у контейнера.
 */

const DEFAULT_MARGIN_TOP = 16
const DEFAULT_MARGIN_BOTTOM = 24
/** Анимация клавиатуры на Android ~250–350 мс: после последнего resize проверяем ещё раз */
const SETTLE_DELAY_MS = 350

const OPT_OUT_SELECTOR = '[data-keyboard-aware="off"]'

function describeEditable(el: HTMLElement): EditableDescriptor {
  const isFormField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement

  return {
    tagName: el.tagName,
    type: el instanceof HTMLInputElement ? el.type : null,
    readOnly: isFormField && el.readOnly,
    disabled: isFormField && el.disabled,
    isContentEditable: el.isContentEditable,
    inputMode: el.inputMode || el.getAttribute('inputmode'),
  }
}

function getFocusedEditable(): HTMLElement | null {
  let el: Element | null = document.activeElement

  // Фокус внутри open shadow root (веб-компоненты)
  while (el?.shadowRoot?.activeElement)
    el = el.shadowRoot.activeElement

  if (!(el instanceof HTMLElement))
    return null

  return isKeyboardEditable(describeEditable(el)) ? el : null
}

function isScrollContainer(el: Element): boolean {
  const style = getComputedStyle(el)

  return /auto|scroll|overlay/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1
}

/**
 * Scroll-контейнеры от ближайшего к внешнему (без документа)
 * + признак того, что элемент находится внутри position: fixed (документ двигать бессмысленно).
 */
function getScrollAncestors(el: HTMLElement): { containers: HTMLElement[], insideFixed: boolean } {
  const containers: HTMLElement[] = []
  let insideFixed = false
  let node: HTMLElement | null = el.parentElement

  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollContainer(node))
      containers.push(node)

    if (getComputedStyle(node).position === 'fixed')
      insideFixed = true

    node = node.parentElement
  }

  return { containers, insideFixed }
}

function readPx(value: string): number {
  const parsed = Number.parseFloat(value)

  return Number.isFinite(parsed) ? parsed : 0
}

/** Для contenteditable ориентируемся на каретку: большие редакторы не нужно показывать целиком */
function getTargetRange(el: HTMLElement): VerticalRange {
  if (el.isContentEditable) {
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
      const caret = selection.getRangeAt(0).getBoundingClientRect()

      if (caret.height > 0)
        return { top: caret.top, bottom: caret.bottom }
    }
  }

  const rect = el.getBoundingClientRect()

  return { top: rect.top, bottom: rect.bottom }
}

function getVisualBounds(): VerticalRange {
  const vv = window.visualViewport
  const top = vv?.offsetTop ?? 0

  return { top, bottom: top + (vv?.height ?? window.innerHeight) }
}

interface RevealMargins {
  top: number
  bottom: number
}

/** Прокручивает один контейнер (или документ при `container = null`). Возвращает true, если что-то сдвинулось */
function revealInContainer(el: HTMLElement, container: Element | null, margins: RevealMargins): boolean {
  const scroller = container ?? document.scrollingElement

  if (!scroller)
    return false

  const visual = getVisualBounds()
  const style = getComputedStyle(scroller)
  // Для документа граница — сама видимая область, для контейнера — пересечение с его прямоугольником
  const rect = container ? container.getBoundingClientRect() : visual
  const band = {
    top: Math.max(visual.top, rect.top + readPx(style.scrollPaddingTop)) + margins.top,
    bottom: Math.min(visual.bottom, rect.bottom - readPx(style.scrollPaddingBottom)) - margins.bottom,
  }
  const delta = computeRevealDelta(getTargetRange(el), band, {
    current: scroller.scrollTop,
    max: scroller.scrollHeight - scroller.clientHeight,
  })

  if (delta === 0)
    return false

  if (container)
    container.scrollBy({ top: delta, behavior: 'instant' })
  else
    window.scrollBy({ top: delta, behavior: 'instant' })

  return true
}

/**
 * Минимально прокручивает контейнеры, чтобы поле оказалось в видимой области.
 * Внутренний контейнер получает приоритет; внешние докручивают остаток
 * (например, когда сам контейнер частично ушёл под клавиатуру).
 */
export function revealEditable(el: HTMLElement): boolean {
  if (!el.isConnected || el.closest(OPT_OUT_SELECTOR))
    return false

  const style = getComputedStyle(el)
  const margins = {
    top: readPx(style.scrollMarginTop) || DEFAULT_MARGIN_TOP,
    bottom: readPx(style.scrollMarginBottom) || DEFAULT_MARGIN_BOTTOM,
  }
  const { containers, insideFixed } = getScrollAncestors(el)
  // Внутри position: fixed прокрутка документа поле не сдвигает
  const scrollers: Array<Element | null> = insideFixed ? containers : [...containers, null]
  let moved = false

  // Два прохода: после прокрутки внешнего контейнера внутренний может получить место
  for (let pass = 0; pass < 2; pass++) {
    const changed = scrollers.map(scroller => revealInContainer(el, scroller, margins)).includes(true)
    moved ||= changed

    if (!changed)
      break
  }

  return moved
}

export function useKeyboardAwareLayout() {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return

  const root = document.documentElement
  const written = new Map<string, string>()

  let baselineWidth = window.innerWidth
  let baselineHeight = window.innerHeight
  let lastVisibleHeight = Number.POSITIVE_INFINITY
  let geometryFrame = 0
  let revealFrame = 0
  let settleTimer: ReturnType<typeof setTimeout> | undefined

  function setVar(name: string, value: string) {
    if (written.get(name) === value)
      return

    written.set(name, value)
    root.style.setProperty(name, value)
  }

  function reveal() {
    revealFrame = 0
    const el = getFocusedEditable()

    if (el)
      revealEditable(el)
  }

  function scheduleReveal(withSettle = false) {
    if (!revealFrame)
      revealFrame = requestAnimationFrame(reveal)

    if (withSettle) {
      clearTimeout(settleTimer)
      settleTimer = setTimeout(reveal, SETTLE_DELAY_MS)
    }
  }

  function updateGeometry() {
    geometryFrame = 0

    // Поворот экрана / изменение ширины окна — новая точка отсчета высоты без клавиатуры
    if (Math.abs(window.innerWidth - baselineWidth) > 1) {
      baselineWidth = window.innerWidth
      baselineHeight = window.innerHeight
    }
    else {
      baselineHeight = Math.max(baselineHeight, window.innerHeight)
    }

    const vv = window.visualViewport
    const editable = getFocusedEditable()
    const geometry = computeKeyboardGeometry({
      layoutHeight: window.innerHeight,
      visualHeight: vv?.height ?? window.innerHeight,
      visualTop: vv?.offsetTop ?? 0,
      scale: vv?.scale ?? 1,
    }, { editableFocused: Boolean(editable), baselineHeight })

    setVar('--visible-height', `${geometry.visibleHeight}px`)
    setVar('--visible-top', `${geometry.visibleTop}px`)
    setVar('--keyboard-inset-height', `${geometry.keyboardInset}px`)
    root.classList.toggle('is-keyboard-open', geometry.isKeyboardOpen)

    // Видимая область уменьшилась (клавиатура открылась/выросла) — проверяем поле.
    // Увеличение (закрытие) и обычная прокрутка видимую область поля не ухудшают.
    if (editable && geometry.visibleHeight < lastVisibleHeight - 1)
      scheduleReveal(true)

    lastVisibleHeight = geometry.visibleHeight
  }

  function scheduleGeometry() {
    if (!geometryFrame)
      geometryFrame = requestAnimationFrame(updateGeometry)
  }

  function onFocusIn() {
    // Клавиатура уже открыта (переход между полями) — достаточно reveal;
    // если еще открывается — reveal повторится на resize видимой области.
    scheduleGeometry()
    scheduleReveal(true)
  }

  function onFocusOut() {
    // Переход фокуса между полями: activeElement проверяется лениво в rAF,
    // поэтому класс is-keyboard-open не мигает.
    scheduleGeometry()
  }

  onMounted(() => {
    updateGeometry()
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('resize', scheduleGeometry)
    window.visualViewport?.addEventListener('resize', scheduleGeometry)
    window.visualViewport?.addEventListener('scroll', scheduleGeometry)
  })

  onUnmounted(() => {
    cancelAnimationFrame(geometryFrame)
    cancelAnimationFrame(revealFrame)
    clearTimeout(settleTimer)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    window.removeEventListener('resize', scheduleGeometry)
    window.visualViewport?.removeEventListener('resize', scheduleGeometry)
    window.visualViewport?.removeEventListener('scroll', scheduleGeometry)
    root.classList.remove('is-keyboard-open')

    for (const name of written.keys())
      root.style.removeProperty(name)
  })
}
