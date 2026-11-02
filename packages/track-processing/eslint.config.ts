import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  formatters: true,
  rules: {
    'ts/no-explicit-any': 'error',
    'no-restricted-properties': ['error', { object: 'z', property: 'any', message: 'Use a concrete schema, or z.unknown() with validation.' }],

    'no-console': 'off',
  },
  ignores: ['dist', 'dist/**'],
})
