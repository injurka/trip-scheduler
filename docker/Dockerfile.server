# Этап 1: Сборщик (Builder)
# Здесь мы собираем наше приложение
FROM oven/bun:1-slim AS builder

WORKDIR /usr/src/app

# Копируем файлы зависимостей
COPY package.json ./

# Устанавливаем ВСЕ зависимости, включая devDependencies, для сборки
RUN bun install

# Копируем весь исходный код проекта
COPY . .

# Собираем TypeScript в JavaScript (команда из вашего package.json)
RUN bun run build


# Этап 2: Финальный образ (Production)
# Здесь мы создаем чистый и легкий образ для запуска
FROM oven/bun:1-slim

# Устанавливаем только РAНТАЙМ-зависимость для sharp, а не тяжелую -dev версию
RUN apt-get update && apt-get install -y --no-install-recommends libvips && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8080

# Копируем package.json, чтобы можно было запустить `bun install --production`
COPY package.json ./
# Устанавливаем только production-зависимости. Bun автоматически определит их по package.json
RUN bun install --production --frozen-lockfile

# Копируем скомпилированное приложение из этапа "builder"
COPY --from=builder /usr/src/app/dist ./dist

# Устанавливаем правильные права и пользователя
RUN chown -R bun:bun /usr/src/app
USER bun

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Запускаем скомпилированный JS-файл, а не исходный TS
CMD ["bun", "run", "dist/server.js"]
