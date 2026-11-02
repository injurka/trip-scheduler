import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'ts/no-explicit-any': 'error',
    'no-restricted-properties': ['error', { object: 'z', property: 'any', message: 'Use a concrete schema, or z.unknown() with validation.' }],

    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'no-console': 'off',
  },
  ignores: ['bun.lock', 'source/**/*'],
})
