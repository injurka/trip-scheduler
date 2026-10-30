export function getVendorChunkName(id: string): string | undefined {
  if (!id.includes('node_modules'))
    return undefined

  const groups: Array<[RegExp | string[], string]> = [
    [/[\\/]node_modules[\\/](?:vue|vue-router|pinia|@vueuse)[\\/]/, 'vendor-core'],
    [['react', 'react-dom'], 'vendor-react'],
    [['@excalidraw', 'veaury'], 'vendor-excalidraw'],
    [['@milkdown'], 'vendor-milkdown'],
    [['mermaid', 'katex', 'elkjs'], 'vendor-editor-addons'],
    [['maplibre-gl', 'd3-geo', '@mapbox/polyline'], 'vendor-map'],
    [['reka-ui', '@iconify'], 'vendor-ui'],
    [['chart.js', 'vue-chartjs'], 'vendor-charts'],
    [['pdfjs-dist'], 'vendor-pdf'],
    [['workbox', 'localforage'], 'vendor-storage'],
    [['vue-advanced-cropper', 'fflate', 'uuid', 'maska', 'ofetch', '@internationalized/date', '@trpc'], 'vendor-utils'],
  ]

  for (const [packages, chunk] of groups) {
    const matches = packages instanceof RegExp
      ? packages.test(id)
      : packages.some(packageName => id.includes(packageName))

    if (matches)
      return chunk
  }

  return 'vendor-others'
}
