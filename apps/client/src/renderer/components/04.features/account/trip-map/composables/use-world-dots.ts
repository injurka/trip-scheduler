import type { GeoProjection } from 'd3-geo'
import type { FeatureCollection } from 'geojson'
import * as d3geo from 'd3-geo'
import { ref } from 'vue'

export function useWorldDots() {
  const dotPathLow = ref<Path2D | null>(null)
  const dotPathHigh = ref<Path2D | null>(null)
  const baseProj = ref<GeoProjection | null>(null)
  const isBuilding = ref(false)

  let geoData: FeatureCollection | null = null

  async function load(): Promise<void> {
    const r = await fetch('/ne_110m_land.geojson')
    if (!r.ok)
      throw new Error(`[WorldDots] GeoJSON ${r.status}`)
    geoData = await r.json()
  }

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

    function createPath(spacing: number, radius: number) {
      const path = new Path2D()
      for (let y = spacing / 2; y < h; y += spacing) {
        for (let x = spacing / 2; x < w; x += spacing) {
          const xi = x | 0
          const yi = y | 0
          if (px[(yi * w + xi) * 4 + 3] > 128) {
            path.moveTo(x + radius, y)
            path.arc(x, y, radius, 0, Math.PI * 2)
          }
        }
      }
      return path
    }

    // Два слоя для Semantic Zoom
    dotPathLow.value = createPath(3.5, 1.05)
    dotPathHigh.value = createPath(1.75, 0.52)

    isBuilding.value = false
  }

  return { dotPathLow, dotPathHigh, baseProj, isBuilding, load, build }
}
