import antfu from '@antfu/eslint-config'

export default antfu({
  markdown: false,
  rules: {
    'ts/no-explicit-any': 'error',
    // TypeScript checks redeclarations and permits a value/type pair.
    'ts/no-redeclare': 'off',
    'no-restricted-properties': ['error', { object: 'z', property: 'any', message: 'Use a concrete schema, or z.unknown() with validation.' }],

    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'e18e/prefer-static-regex': 'off',
  },
  ignores: ['**/.types/**', '**/dump/**', '**/drizzle/**', 'bun.lock', 'readme.md'],
})
