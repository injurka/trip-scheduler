import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'e18e/prefer-static-regex': 'off',
  },
  ignores: ['**/dump/**', '**/drizzle/**', 'bun.lock', 'readme.md'],
})
