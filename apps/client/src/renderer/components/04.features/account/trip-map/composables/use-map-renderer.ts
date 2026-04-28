import type { GeoProjection } from 'd3-geo'
import type { Ref } from 'vue'
import type { MapCity } from './use-trip-map'

const CITY_R = 5.5
const GLOW_R = 18

// ─── Color cache ──────────────────────────────────────────────────────────────
// toRgba() создаёт canvas+getImageData только при смене цвета темы, не каждый кадр.
let _accentRaw = ''
let _dotRaw = ''
let _glowIn = ''
let _glowOut = ''

function readVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function toRgba(css: string, a: number): string {
  const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 })
  const x = c.getContext('2d')!
  x.fillStyle = css
  x.fillRect(0, 0, 1, 1)
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data
  return `rgba(${r},${g},${b},${a})`
}

function getColors() {
  const dot = readVar('--fg-tertiary-color', '#6b7280')
  const accent = readVar('--fg-accent-color', '#4f98a3')
  if (accent !== _accentRaw) {
    _accentRaw = accent
    _glowIn = toRgba(accent, 0.55)
    _glowOut = toRgba(accent, 0)
  }
  _dotRaw = dot
  return { dot, accent, glowIn: _glowIn, glowOut: _glowOut }
}

/**
 * Canvas-рендерер для карты.
 *
 * Ключевая оптимизация: точки суши хранятся в Path2D и
 * рисуются одним вызовом ctx.fill(path) — GPU-операция без циклов на JS.
 * Трансформация зума/пана применяется через ctx.setTransform без пересчёта координат.
 * City-маркеры рисуются в экранных координатах (фиксированный размер при любом зуме).
 * Все draw-вызовы батчатся через requestAnimationFrame.
 */
export function useMapRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  citiesRef: Ref<MapCity[]>,
) {
  let rafId = 0
  let pendingFn: (() => void) | null = null

  // ─── Внутренний draw-примитив ─────────────────────────────────────────────
  function drawImmediate(
    w: number,
    h: number,
    dotPath: Path2D,
    baseProj: GeoProjection,
    scale: number,
    tx: number,
    ty: number,
  ): void {
    const canvas = canvasRef.value
    if (!canvas)
      return

    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')!
    const { dot, accent, glowIn, glowOut } = getColors()

    // ── 1. Сброс трансформа + очистка ────────────────────────────────────────
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // ── 2. Зум / пан через canvas transform (зум к центру канваса + смещение) ─
    //    screenX = (baseX - w/2) * scale + w/2 + tx
    ctx.translate(w / 2 + tx, h / 2 + ty)
    ctx.scale(scale, scale)
    ctx.translate(-w / 2, -h / 2)

    // ── 3. Точки суши — единственный GPU-вызов ────────────────────────────────
    ctx.fillStyle = dot
    ctx.fill(dotPath)

    // ── 4. City-маркеры — в экранных координатах (размер не меняется при зуме) ─
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    for (const city of citiesRef.value) {
      const base = baseProj([city.lon, city.lat])
      if (!base)
        continue

      // Перевод base-координат в экранные с учётом текущего зума/пана
      const cx = (base[0] - w / 2) * scale + w / 2 + tx
      const cy = (base[1] - h / 2) * scale + h / 2 + ty

      if (cx < -GLOW_R || cx > w + GLOW_R || cy < -GLOW_R || cy > h + GLOW_R)
        continue

      // Glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, GLOW_R)
      g.addColorStop(0, glowIn)
      g.addColorStop(1, glowOut)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, GLOW_R, 0, Math.PI * 2)
      ctx.fill()

      // Точка
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(cx, cy, CITY_R, 0, Math.PI * 2)
      ctx.fill()

      // Блик
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(cx, cy, CITY_R * 0.38, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ─── Публичный draw — батчится через rAF ─────────────────────────────────
  function draw(
    w: number,
    h: number,
    dotPath: Path2D | null,
    baseProj: GeoProjection | null,
    scale: number,
    tx: number,
    ty: number,
  ): void {
    if (!dotPath || !baseProj)
      return

    pendingFn = () => drawImmediate(w, h, dotPath, baseProj, scale, tx, ty)

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = 0
        pendingFn?.()
        pendingFn = null
      })
    }
  }

  function cancelPending(): void {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    pendingFn = null
  }

  return { draw, cancelPending }
}
