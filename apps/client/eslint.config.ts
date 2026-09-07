import antfu from '@antfu/eslint-config'
import storybook from 'eslint-plugin-storybook'

export default antfu({
  vue: true,
  markdown: false,
  formatters: true,
  ignores: [
    '**/.vitestcache/**',
    '**/e2e-**/**',
    '**/assets/**',
    '**/public/**',
    'auto-imports.d.ts',
    'bun.lock',
    'maplibre-gl-worker.js',
  ],
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
  plugins: [storybook],
})
