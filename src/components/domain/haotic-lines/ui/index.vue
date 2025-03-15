<script lang="ts" setup>
import type { P5I } from 'p5i'
import { useDebounceFn } from '@vueuse/core'
import { p5i } from 'p5i'

interface Props {
  width?: number
  height?: number
  scaleFactor?: number
  pointsCounts?: number
  speed?: number
  weightStroke?: number
  color?: string
  cap?: boolean
  viewportEl?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  width: 0,
  height: 0,
  scaleFactor: 1.1,
  pointsCounts: 8,
  speed: 1.5,
  weightStroke: 10,
  color: '--bg-accent-overlay-color',
  cap: true,
  viewportEl: null,
})

const haoticLineEl = ref<HTMLElement | null>(null)
const haoticLineCanvas = ref<P5I | null>(null)
const viewport = computed(() => ({
  width: props.viewportEl?.offsetWidth || props.width,
  height: props.viewportEl?.offsetHeight || props.height,
}))

const points = ref<{ x: number, y: number, dx: number, dy: number }[]>([])

function createHaoticLines(el: HTMLElement) {
  const sketch = p5i(() => {
    const {
      speed,
      pointsCounts,
      scaleFactor,
      weightStroke,
      color,
    } = props

    const {
      width: widthEl,
      height: heightEl,
    } = viewport.value

    return {
      setup({ createCanvas, random, WEBGL }) {
        const canvas = createCanvas(widthEl, heightEl, WEBGL)
        canvas.parent(el)

        const step = (widthEl * 1) / (pointsCounts - 1)

        const scalefactorX = scaleFactor * Math.max(heightEl / widthEl, 1)
        const scalefactorY = scaleFactor * Math.max(widthEl / heightEl, 1)

        points.value = []

        for (let i = 0; i < pointsCounts; i++) {
          points.value.push({
            x: i * step - (widthEl * scalefactorX) / 2,
            y: random(-(heightEl / 2) * scalefactorY, (heightEl / 2) * scalefactorY),
            dx: random(-speed, speed),
            dy: random(-speed, speed),
          })
        }
      },
      draw({
        background,
        beginShape,
        vertex,
        endShape,
        width,
        height,
        CLOSE,
        dist,
        ellipse,
        noFill,
        stroke,
        strokeWeight,
      }: P5I) {
        background(0, 0)
        strokeWeight(weightStroke)
        stroke(getComputedStyle(document.documentElement).getPropertyValue(color))
        noFill()

        beginShape()
        for (const point of points.value) {
          vertex(point.x, point.y)
          point.x += point.dx
          point.y += point.dy

          if (point.x < -width / 2 || point.x > width / 2) {
            point.dx = -point.dx
          }
          if (point.y < -height / 2 || point.y > height / 2) {
            point.dy = -point.dy
          }
        }
        endShape(props.cap ? CLOSE : undefined)

        checkIntersection()

        function checkIntersection() {
          for (let i = 0; i < points.value.length; i++) {
            for (let j = i + 1; j < points.value.length; j++) {
              if (dist(points.value[i].x, points.value[i].y, points.value[j].x, points.value[j].y) < 10) {
                ellipse(points.value[i].x, points.value[i].y, 10, 10)
              }
            }
          }
        }
      },
      windowResized({ resizeCanvas }) {
        const { width: widthEl, height: heightEl } = viewport.value
        resizeCanvas(widthEl, heightEl)
      },
    }
  })
  sketch.mount(el)
  return sketch
}

async function createSketchs() {
  if (!haoticLineEl.value) {
    return
  }
  await nextTick()
  if (haoticLineCanvas.value) {
    try {
      haoticLineCanvas.value.remove()
    }
    catch (error) {
      console.warn('Error removing canvas:', error)
    }
  }

  try {
    haoticLineCanvas.value = createHaoticLines(haoticLineEl.value)
  }
  catch (error) {
    console.error('Error creating sketch:', error)
  }
}

const debouncedResizeListener = useDebounceFn(createSketchs, 250)

onMounted(() => {
  createSketchs()
  window.addEventListener('resize', debouncedResizeListener)
})

onUnmounted(() => {
  window.removeEventListener('resize', debouncedResizeListener)
  if (haoticLineCanvas.value) {
    try {
      haoticLineCanvas.value.remove()
    }
    catch (error) {
      console.warn('Error removing canvas on unmount:', error)
    }
  }
})

watch(viewport, () => {
  createSketchs()
}, { deep: true })

watch(props, () => {
  createSketchs()
}, { deep: true })
</script>

<template>
  <div
    ref="haoticLineEl"
    class="haotic-line"
  />
</template>

<style lang="scss" scoped>
.haotic-line {
  position: absolute;
  overflow: hidden;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  filter: blur(30px);
  z-index: 5;
}
</style>
