import type { GeoProjection } from 'd3-geo'
import type { FeatureCollection } from 'geojson'
import * as d3geo from 'd3-geo'
import { ref } from 'vue'

const DOT_SPACING = 3.5
const DOT_RADIUS = 1.05

/**
 * Загружает GeoJSON один раз и строит Path2D для быстрой отрисовки.
 * Path2D пересоздаётся только при изменении размера канваса (не каждый кадр).
 */
export function useWorldDots() {
  const dotPath = ref<Path2D | null>(null)
  const baseProj = ref<GeoProjection | null>(null)
  const isBuilding = ref(false)

  let geoData: FeatureCollection | null = null

  async function load(): Promise<void> {
    const r = await fetch('/ne_110m_land.geojson')
    if (!r.ok)
      throw new Error(`[WorldDots] GeoJSON ${r.status}`)
    geoData = await r.json()
  }

  /**
   * Строит Path2D для заданного размера канваса.
   * Вызывается однократно на mount и при resize — НЕ при каждом кадре.
   */
  function build(w: number, h: number): void {
    if (!geoData || w <= 0 || h <= 0)
      return

    isBuilding.value = true

    const proj = d3geo.geoNaturalEarth1()
      .scale(w / 6.28)
      .translate([w / 2, h / 2])

    baseProj.value = proj

    // Offscreen растеризация полигонов суши
    const off = Object.assign(document.createElement('canvas'), { width: w, height: h })
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    d3geo.geoPath(proj, ctx)(geoData!)
    ctx.fill()
    const px = ctx.getImageData(0, 0, w, h).data

    // Path2D строится один раз — отрисовка сводится к единственному ctx.fill(path)
    const path = new Path2D()
    for (let y = DOT_SPACING / 2; y < h; y += DOT_SPACING) {
      for (let x = DOT_SPACING / 2; x < w; x += DOT_SPACING) {
        const xi = x | 0
        const yi = y | 0
        if (px[(yi * w + xi) * 4 + 3] > 128) {
          path.moveTo(x + DOT_RADIUS, y)
          path.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
        }
      }
    }

    dotPath.value = path
    isBuilding.value = false
  }

  return { dotPath, baseProj, isBuilding, load, build }
}
