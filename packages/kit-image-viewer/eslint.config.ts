import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/no-explicit-any': 'error',
    'no-restricted-properties': ['error', { object: 'z', property: 'any', message: 'Use a concrete schema, or z.unknown() with validation.' }],
  },
  vue: true,
  formatters: true,
  ignores: [
    'dist/**',
    'node_modules/**',
  ],
})
