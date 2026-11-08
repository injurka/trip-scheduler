import { describe, expect, it } from 'bun:test'
import { computeKeyboardGeometry, computeRevealDelta, isKeyboardEditable } from '../src/renderer/shared/lib/keyboard-aware'

const SCREEN = 800

describe('computeKeyboardGeometry', () => {
  it('без клавиатуры видимая область равна окну', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: SCREEN, visualHeight: SCREEN, visualTop: 0, scale: 1 }, { editableFocused: false, baselineHeight: SCREEN })
    expect(geometry).toEqual({
      visibleHeight: SCREEN,
      visibleTop: 0,
      keyboardInset: 0,
      isKeyboardOpen: false,
      mode: 'none',
    })
  })

  it('WebView M139+: клавиатура уменьшает visual viewport, layout не меняется', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: SCREEN, visualHeight: 480, visualTop: 0, scale: 1 }, { editableFocused: true, baselineHeight: SCREEN })
    expect(geometry.mode).toBe('visual-viewport')
    expect(geometry.isKeyboardOpen).toBe(true)
    expect(geometry.visibleHeight).toBe(480)
    expect(geometry.keyboardInset).toBe(320)
  })

  it('учитывает сдвиг visual viewport, не удваивая отступ', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: SCREEN, visualHeight: 480, visualTop: 100, scale: 1 }, { editableFocused: true, baselineHeight: SCREEN })
    expect(geometry.visibleTop).toBe(100)
    // 800 - 480 - 100: нижняя граница видимой области совпадает с bottom шторки
    expect(geometry.keyboardInset).toBe(220)
  })

  it('adjustResize / resizes-content: окно уменьшилось целиком — inset не нужен', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: 480, visualHeight: 480, visualTop: 0, scale: 1 }, { editableFocused: true, baselineHeight: SCREEN })
    expect(geometry.mode).toBe('resize')
    expect(geometry.keyboardInset).toBe(0)
    expect(geometry.visibleHeight).toBe(480)
  })

  it('уменьшение без фокуса на поле (панель браузера, аппаратная клавиатура) — не клавиатура', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: SCREEN, visualHeight: 480, visualTop: 0, scale: 1 }, { editableFocused: false, baselineHeight: SCREEN })
    expect(geometry.isKeyboardOpen).toBe(false)
    expect(geometry.keyboardInset).toBe(0)
    expect(geometry.visibleHeight).toBe(SCREEN)
  })

  it('мелкие изменения ниже порога игнорируются', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: SCREEN, visualHeight: SCREEN - 56, visualTop: 0, scale: 1 }, { editableFocused: true, baselineHeight: SCREEN })
    expect(geometry.isKeyboardOpen).toBe(false)
  })

  it('pinch-zoom не принимается за клавиатуру', () => {
    const geometry = computeKeyboardGeometry({ layoutHeight: SCREEN, visualHeight: 400, visualTop: 200, scale: 2 }, { editableFocused: true, baselineHeight: SCREEN })
    expect(geometry.isKeyboardOpen).toBe(false)
    expect(geometry.keyboardInset).toBe(0)
    expect(geometry.visibleHeight).toBe(SCREEN)
  })
})

describe('computeRevealDelta', () => {
  const band = { top: 100, bottom: 500 }
  const scroll = { current: 200, max: 1000 }

  it('видимое поле не двигается', () => {
    expect(computeRevealDelta({ top: 200, bottom: 240 }, band, scroll)).toBe(0)
  })

  it('перекрытое снизу поле поднимается ровно до границы', () => {
    expect(computeRevealDelta({ top: 600, bottom: 640 }, band, scroll)).toBe(140)
  })

  it('ушедшее вверх поле опускается минимально', () => {
    expect(computeRevealDelta({ top: 40, bottom: 80 }, band, scroll)).toBe(-60)
  })

  it('не прокручивает дальше запаса контейнера', () => {
    expect(computeRevealDelta({ top: 600, bottom: 640 }, band, { current: 950, max: 1000 })).toBe(50)
    expect(computeRevealDelta({ top: 40, bottom: 80 }, band, { current: 10, max: 1000 })).toBe(-10)
  })

  it('большое поле: достаточно заметной видимой части', () => {
    expect(computeRevealDelta({ top: 300, bottom: 1200 }, band, scroll)).toBe(0)
    // видно только 20px — выравниваем верх поля по верху области
    expect(computeRevealDelta({ top: 480, bottom: 1400 }, band, scroll)).toBe(380)
  })

  it('пустая видимая область — ничего не делаем', () => {
    expect(computeRevealDelta({ top: 600, bottom: 640 }, { top: 300, bottom: 280 }, scroll)).toBe(0)
  })
})

describe('isKeyboardEditable', () => {
  it('текстовые поля вызывают клавиатуру', () => {
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'text' })).toBe(true)
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'number' })).toBe(true)
    expect(isKeyboardEditable({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isKeyboardEditable({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('кнопки, чекбоксы, readonly и inputmode=none — нет', () => {
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'range' })).toBe(false)
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'text', readOnly: true })).toBe(false)
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'text', inputMode: 'none' })).toBe(false)
    expect(isKeyboardEditable({ tagName: 'BUTTON' })).toBe(false)
  })
})
