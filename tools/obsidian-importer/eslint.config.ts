import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  regexp: false,
  rules: {
    'ts/no-explicit-any': 'error',
    'no-restricted-properties': ['error', { object: 'z', property: 'any', message: 'Use a concrete schema, or z.unknown() with validation.' }],

    'no-cond-assign': 'off',
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
  },
  ignores: ['bun.lock', 'dist'],
})
