import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  ignores: [
    '**/.vitestcache/**',
    '**/e2e-**/**',
    '**/src-tauri/**',
  ],
})
