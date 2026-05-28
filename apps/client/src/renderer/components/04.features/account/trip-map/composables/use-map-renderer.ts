import type { GeoProjection } from 'd3-geo'
import type { Ref } from 'vue'
import type { MapCity } from './use-trip-map'

// Размеры точек уменьшены в два раза (5.5 -> 2.75, 18 -> 9)
const CITY_R = 2.75
const GLOW_R = 9

// ─── Color cache ──────────────────────────────────────────────────────────────
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

export function useMapRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  citiesRef: Ref<MapCity[]>,
) {
  let rafId = 0
  let pendingFn: (() => void) | null = null

  function drawImmediate(
    w: number,
    h: number,
    dotPath: Path2D,
    baseProj: GeoProjection,
    scale: number,
    tx: number,
    ty: number,
    hoveredId: string | null = null,
    selectedId: string | null = null,
  ): void {
    const canvas = canvasRef.value
    if (!canvas)
      return

    const dpr = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')!
    const { dot, accent, glowIn, glowOut } = getColors()

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    ctx.translate(w / 2 + tx, h / 2 + ty)
    ctx.scale(scale, scale)
    ctx.translate(-w / 2, -h / 2)

    ctx.fillStyle = dot
    ctx.fill(dotPath)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const normalCities: MapCity[] = []
    const elevatedCities: MapCity[] = []

    for (const city of citiesRef.value) {
      if (city.id === hoveredId || city.id === selectedId)
        elevatedCities.push(city)
      else normalCities.push(city)
    }

    function drawCity(city: MapCity) {
      const base = baseProj([city.lon, city.lat])
      if (!base)
        return

      const cx = (base[0] - w / 2) * scale + w / 2 + tx
      const cy = (base[1] - h / 2) * scale + h / 2 + ty

      if (cx < -GLOW_R * 3 || cx > w + GLOW_R * 3 || cy < -GLOW_R * 3 || cy > h + GLOW_R * 3)
        return

      const isSelected = city.id === selectedId
      const isHovered = city.id === hoveredId
      const rMultiplier = isSelected ? 2.5 : (isHovered ? 1.6 : 1)

      const cr = CITY_R * rMultiplier
      const gr = GLOW_R * rMultiplier

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr)
      g.addColorStop(0, glowIn)
      g.addColorStop(1, glowOut)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, gr, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(cx, cy, cr * 0.38, 0, Math.PI * 2)
      ctx.fill()
    }

    normalCities.forEach(drawCity)
    elevatedCities.forEach(drawCity)
  }

  function draw(
    w: number,
    h: number,
    dotPath: Path2D | null,
    baseProj: GeoProjection | null,
    scale: number,
    tx: number,
    ty: number,
    hoveredId: string | null = null,
    selectedId: string | null = null,
  ): void {
    if (!dotPath || !baseProj)
      return

    pendingFn = () => drawImmediate(w, h, dotPath, baseProj, scale, tx, ty, hoveredId, selectedId)

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
