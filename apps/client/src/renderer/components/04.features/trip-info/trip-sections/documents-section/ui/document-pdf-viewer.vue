<script setup lang="ts">
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { Icon } from '@iconify/vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { resolveApiUrl } from '~/shared/lib/url'

interface Props {
  url: string
  title?: string
}

const props = defineProps<Props>()

// Настройка веб-воркера для PDF.js
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const currentPage = ref(1)
const totalPages = ref(0)
const zoomLevel = ref(1.0)
const naturalWidth = ref(600)

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const pdfDoc = shallowRef<PDFDocumentProxy | null>(null)
let currentRenderTask: RenderTask | null = null

const zoomPercent = computed(() => `${Math.round(zoomLevel.value * 100)}%`)

async function fetchPdfData(url: string): Promise<ArrayBuffer> {
  const absoluteUrl = resolveApiUrl(url)

  // 1. Попытка загрузить из оффлайн-кэша медиафайлов
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('trip-scheduler-offline-media')
      const match = await cache.match(absoluteUrl) || await cache.match(url)
      if (match) {
        return await match.arrayBuffer()
      }
    }
    catch {
      // Игнорируем ошибку кэша
    }
  }

  // 2. Сетевой запрос
  const response = await fetch(absoluteUrl)
  if (!response.ok) {
    throw new Error(`Ошибка загрузки (${response.status}: ${response.statusText})`)
  }
  return await response.arrayBuffer()
}

async function renderCurrentPage() {
  if (!pdfDoc.value || !canvasRef.value)
    return

  if (currentRenderTask) {
    currentRenderTask.cancel()
    currentRenderTask = null
  }

  try {
    const page = await pdfDoc.value.getPage(currentPage.value)
    const unscaledViewport = page.getViewport({ scale: 1.0 })
    naturalWidth.value = unscaledViewport.width

    const viewport = page.getViewport({ scale: zoomLevel.value })
    const canvas = canvasRef.value
    const context = canvas.getContext('2d')

    if (!context)
      return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`

    context.scale(dpr, dpr)

    currentRenderTask = page.render({
      canvasContext: context,
      canvas,
      viewport,
    })

    await currentRenderTask.promise
    currentRenderTask = null
  }
  catch (err: any) {
    if (err?.name === 'RenderingCancelledException') {
      return
    }
    console.error('[PdfViewer] Ошибка рендеринга страницы:', err)
  }
}

async function fitToWidth() {
  if (!pdfDoc.value)
    return

  try {
    const page = await pdfDoc.value.getPage(currentPage.value)
    const unscaledViewport = page.getViewport({ scale: 1.0 })
    naturalWidth.value = unscaledViewport.width

    await nextTick()
    if (containerRef.value) {
      const containerWidth = containerRef.value.clientWidth - 32
      if (containerWidth > 0 && unscaledViewport.width > 0) {
        zoomLevel.value = Math.min(2.0, Math.max(0.4, Number((containerWidth / unscaledViewport.width).toFixed(2))))
      }
    }
    await renderCurrentPage()
  }
  catch (e) {
    console.warn('[PdfViewer] Ошибка fitToWidth:', e)
  }
}

async function loadPdf() {
  if (!props.url)
    return

  isLoading.value = true
  errorMessage.value = null

  try {
    const data = await fetchPdfData(props.url)
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
    })

    const doc = await loadingTask.promise
    pdfDoc.value = doc
    totalPages.value = doc.numPages
    currentPage.value = 1

    await fitToWidth()
  }
  catch (err: any) {
    console.error('[PdfViewer] Ошибка загрузки PDF:', err)
    errorMessage.value = err?.message || 'Не удалось открыть PDF-файл'
  }
  finally {
    isLoading.value = false
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    renderCurrentPage()
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    renderCurrentPage()
  }
}

function zoomIn() {
  zoomLevel.value = Math.min(3.0, Number((zoomLevel.value + 0.15).toFixed(2)))
  renderCurrentPage()
}

function zoomOut() {
  zoomLevel.value = Math.max(0.3, Number((zoomLevel.value - 0.15).toFixed(2)))
  renderCurrentPage()
}

function resetZoom() {
  fitToWidth()
}

watch(() => props.url, () => {
  loadPdf()
})

onMounted(() => {
  loadPdf()
})

onBeforeUnmount(() => {
  if (currentRenderTask) {
    currentRenderTask.cancel()
    currentRenderTask = null
  }
  if (pdfDoc.value) {
    pdfDoc.value.cleanup()
    pdfDoc.value.loadingTask?.destroy()
    pdfDoc.value = null
  }
})
</script>

<template>
  <div class="pdf-viewer-container">
    <!-- Тулбар управления PDF -->
    <div v-if="!errorMessage && !isLoading && totalPages > 0" class="pdf-toolbar">
      <!-- Навигация по страницам -->
      <div class="page-controls">
        <button
          type="button"
          class="pdf-btn"
          :disabled="currentPage <= 1"
          title="Предыдущая страница"
          @click="prevPage"
        >
          <Icon icon="mdi:chevron-left" width="18" height="18" />
        </button>

        <span class="page-counter">
          {{ currentPage }} / {{ totalPages }}
        </span>

        <button
          type="button"
          class="pdf-btn"
          :disabled="currentPage >= totalPages"
          title="Следующая страница"
          @click="nextPage"
        >
          <Icon icon="mdi:chevron-right" width="18" height="18" />
        </button>
      </div>

      <!-- Зум -->
      <div class="zoom-controls">
        <button
          type="button"
          class="pdf-btn"
          :disabled="zoomLevel <= 0.35"
          title="Уменьшить"
          @click="zoomOut"
        >
          <Icon icon="mdi:minus" width="16" height="16" />
        </button>

        <button
          type="button"
          class="pdf-btn zoom-indicator-btn"
          title="Сбросить масштаб"
          @click="resetZoom"
        >
          {{ zoomPercent }}
        </button>

        <button
          type="button"
          class="pdf-btn"
          :disabled="zoomLevel >= 2.8"
          title="Увеличить"
          @click="zoomIn"
        >
          <Icon icon="mdi:plus" width="16" height="16" />
        </button>

        <button
          type="button"
          class="pdf-btn"
          title="Вместить по ширине"
          @click="fitToWidth"
        >
          <Icon icon="mdi:arrow-expand-horizontal" width="16" height="16" />
        </button>
      </div>
    </div>

    <!-- Загрузка -->
    <div v-if="isLoading" class="pdf-state-box">
      <Icon icon="mdi:loading" class="spin" width="32" height="32" />
      <span>Загрузка PDF-документа...</span>
    </div>

    <!-- Ошибка -->
    <div v-else-if="errorMessage" class="pdf-state-box is-error">
      <Icon icon="mdi:alert-circle-outline" width="36" height="36" />
      <span class="error-text">{{ errorMessage }}</span>
      <KitBtn size="sm" variant="outlined" icon="mdi:reload" @click="loadPdf">
        Повторить попытку
      </KitBtn>
    </div>

    <!-- Область отображения Canvas -->
    <div ref="containerRef" class="pdf-canvas-wrapper">
      <canvas ref="canvasRef" class="pdf-canvas" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.pdf-viewer-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 65vh;
  min-height: 480px;
  background-color: #525659;
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  position: relative;

  @media (max-width: 600px) {
    height: 55vh;
    min-height: 380px;
  }
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  background-color: rgba(30, 30, 30, 0.88);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  z-index: 2;
  flex-shrink: 0;
}

.page-controls,
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-counter {
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0 6px;
  min-width: 48px;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
}

.pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
  border-radius: var(--r-xs);
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &.zoom-indicator-btn {
    min-width: 44px;
    font-size: 0.75rem;
    font-weight: 600;
  }
}

.pdf-canvas-wrapper {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.pdf-canvas {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  border-radius: 2px;
  background-color: #fff;
}

.pdf-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 16px;
  flex: 1;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;

  &.is-error {
    color: #f87171;
  }

  .error-text {
    max-width: 400px;
    text-align: center;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
