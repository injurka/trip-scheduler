import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'ts/consistent-type-definitions': 'off',
  },
  ignores: ['**/dump/**', 'bun.lock'],
})
