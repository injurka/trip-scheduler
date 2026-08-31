import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  regexp: false,
  rules: {
    'no-cond-assign': 'off',
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
  },
  ignores: ['bun.lock', 'dist'],
})
