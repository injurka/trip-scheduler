import { defineConfig } from 'tsup'

export default defineConfig({
  // Файлы, с которых начинается сборка
  entry: ['src/index.ts', 'src/run.ts'],

  // Директория для собранных файлов
  outDir: 'dist',

  // Формат модулей 'esm'
  format: ['esm'],

  // Целевая среда 'esnext' для Bun
  target: 'esnext',

  // Не разбивать код на чанки
  splitting: false,

  // Генерировать source maps для отладки
  sourcemap: true,

  // Очищать 'dist' перед каждой сборкой
  clean: true,

  // Добавлять shims для __dirname и __filename
  shims: true,

  // Не минифицировать код
  minify: false,
})
