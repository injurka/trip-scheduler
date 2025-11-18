import { defineConfig } from 'tsup'

export default defineConfig({
  // Файл, с которого начинается сборка
  entry: ['src/server.ts'],

  // Директория для собранных файлов (как у вас и было)
  outDir: 'dist',

  // Формат модулей. 'esm' - потому что у вас в package.json "type": "module"
  format: ['esm'],

  // Целевая среда. 'esnext' хорошо подходит для Bun
  target: 'esnext',

  // Не разбивать код на чанки. Для сервера лучше иметь один файл.
  splitting: false,

  // Генерировать source maps для удобной отладки
  sourcemap: true,

  // Очищать директорию 'dist' перед каждой сборкой
  clean: true,

  // Добавлять shims для __dirname и __filename, что полезно в ESM
  shims: true,

  // Не минифицировать код, чтобы было легче читать ошибки в продакшене
  minify: false,
})
