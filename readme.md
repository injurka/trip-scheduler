# 📅 Trip Scheduler: Планировщик Путешествий

**Trip Scheduler** — это комплексное решение для создания идеальных маршрутов путешествий и сохранения воспоминаний.

[![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-24C8DB?logo=tauri)](https://v2.tauri.app/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono)](https://hono.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-2B81C8?logo=trpc)](https://trpc.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Bun](https://img.shields.io/badge/Bun-black?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)

![250812_02h26m13s_screenshot](assets/250812_02h26m13s_screenshot.png)

## 🏗️ Архитектура проекта

Проект организован как монорепозиторий, управляемый с помощью `Bun Workspaces`.

-   **`apps/client` (Клиентское приложение)**
    -   **Фреймворк:** Vue 3 (Composition API), Vite.
    -   **Нативная версия (десктоп + мобильная):** Tauri 2 — отдельная обёртка в `apps/native`.
    -   **Управление состоянием:** Pinia для централизованного и модульного управления состоянием.
    -   **Архитектура:** Код организован по слоям (`01.kit`, `02.shared`, `03.domain`, `04.features`, `05.modules`, `06.layouts`) для обеспечения низкой связанности и высокой переиспользуемости.

-   **`apps/native` (Нативная обёртка Tauri)**
    -   **Десктоп:** Linux (deb/AppImage/rpm), Windows (MSI/NSIS), macOS (dmg).
    -   **Мобильные:** Android (APK/AAB) и iOS через `tauri android` / `tauri ios`.
    -   Команды vault-хранилища (выбор папки, скачивание и удаление файлов) реализованы на Rust.

-   **`apps/server` (Серверная часть)**
    -   **Среда выполнения и фреймворк:** Bun и Hono для создания высокопроизводительного API.
    -   **API:** tRPC для построения типобезопасного API и REST для специфичных задач (загрузка файлов, OAuth).
    -   **База данных:** PostgreSQL с Drizzle ORM для работы с данными.
    -   **Дополнительно:** Интеграция с LLM для распознавания данных, OAuth-авторизация, мониторинг через Prometheus.

-   **`tools/scraper` (Скрапер данных)**
    -   Отдельный инструмент для сбора данных из внешних источников (например, TripAdvisor) с использованием Playwright, Puppeteer и LLM.

-   **`tools/browse-agent` (Автономный браузерный агент)**
    -   Утилита для взаимодействия с веб-страницами и извлечения информации.

-   **`docker` (Инфраструктура)**
    -   Конфигурации для запуска окружения, включая **Grafana** для мониторинга производительности.


## 🛠️ Установка и запуск

### Предварительные требования

-   [Bun](https://bun.sh/) (v1.4.0 или выше).
-   [Docker](https://www.docker.com/get-started/) и Docker Compose.

### Пошаговая инструкция

1.  **Клонируйте репозиторий:**
    ```bash
    git clone https://github.com/injurkx/trip-scheduler
    cd trip-scheduler
    ```

2.  **Установите зависимости во всем проекте:**
    ```bash
    bun install
    ```

3.  **Настройте и запустите бэкенд:**

    a. **Запустите контейнер с PostgreSQL:**
    ```bash
    docker run -p 5432:5432 \
      --name trip-scheduler-db \
      -e POSTGRES_USER=trip-scheduler \
      -e POSTGRES_PASSWORD=trip-scheduler \
      -e POSTGRES_DB=trip_scheduler_dev \
      -d \
      --restart always \
      postgres:latest
    ```

    b. **Создайте файл окружения** в `apps/server/.env` и добавьте в него:
    ```env
    DATABASE_URL="postgresql://trip-scheduler:trip-scheduler@localhost:5432/trip_scheduler_dev"
    API_URL="http://localhost:8080"
    ```

    c. **Примените миграции и наполните БД сервера:**
    ```bash
    bun --cwd ./apps/server run db:migrate
    bun --cwd ./apps/server run db:seed-mock
    ```

### Запуск в режиме разработки

Откройте два терминала для одновременного запуска сервера и клиента.

1.  **Запустите сервер:**
    ```bash
    bun --cwd ./apps/server dev
    ```
    Сервер tRPC будет доступен по адресу `http://localhost:8080`.

2.  **Запустите клиент (Tauri или Веб):**

    *   Для **нативного приложения (Tauri)** — сам поднимет dev-сервер клиента:
        ```bash
        bun run dev:native
        ```
    *   Для **веб-версии**:
        ```bash
        bun run dev:client
        ```
    *   Для **просмотра UI-компонентов в Storybook**:
        ```bash
        bun --cwd ./apps/client storybook:dev
        ```

## 📜 Доступные скрипты

| Команда                                | Описание                                                               | Воркспейс      |
| :------------------------------------- | :--------------------------------------------------------------------- | :------------- |
| **Разработка**                         |                                                                        |                |
| `bun dev:client`                       | Запуск веб-клиента в режиме разработки.                                | `root`         |
| `bun dev:server`                       | Запуск сервера API в режиме разработки.                                | `root`         |
| `bun dev:native`                       | Запуск нативного приложения (Tauri) в режиме разработки.               | `root`         |
| `bun storybook:dev`                    | Запуск Storybook для просмотра UI-компонентов.                         | `client`       |
| **Сборка**                             |                                                                        |                |
| `bun build`                            | Сборка production-версии сервера и клиента.                            | `root`         |
| `bun build:web`                        | Сборка production-версии веб-клиента.                                  | `root`         |
| `bun build:native`                     | Сборка нативного приложения (Tauri, текущая ОС).                       | `root`         |
| `bun build:native:linux:x64`           | Сборка нативного приложения под Linux x64.                             | `root`         |
| `bun build:native:win:x64`             | Сборка нативного приложения под Windows x64.                           | `root`         |
| `bun build:native:android`             | Сборка APK (требуется `tauri android init` и Android SDK).             | `root`         |
| **База данных (Сервер)**               |                                                                        |                |
| `bun db:migrate`                       | Применение миграций к БД сервера (PostgreSQL).                         | `server`       |
| `bun db:generate`                      | Генерация новых миграций на основе схемы Drizzle.                      | `server`       |
| `bun db:seed-mock`                     | Интерактивное наполнение БД тестовыми данными из моков.                | `server`       |
| `bun db:seed-json`                     | Интерактивное наполнение БД из JSON-дампа.                             | `server`       |
| `bun db:dump`                          | Создание JSON-дампа текущего состояния БД.                             | `server`       |
| `bun db:check`                         | Проверка и вывод статистики по данным в БД.                            | `server`       |
| `bun db:studio`                        | Запуск Drizzle Studio для просмотра и редактирования данных.           | `server`       |
| **Линтинг и типизация**                |                                                                        |                |
| `bun lint`                             | Проверка кода всего проекта с помощью ESLint.                          | `root`         |
| `bun typecheck`                        | Проверка типов TypeScript во всем проекте.                             | `root`         |
| **Мобильная сборка (Tauri)**           |                                                                        |                |
| `bun run --filter '@injurka/trip-scheduler-native' tauri:android:init` | Инициализация Android-проекта (генерирует `gen/android`). | `native`       |
| `bun build:native:android`             | Сборка Android APK.                                                    | `root`         |

## 📜 Пример приложения

![250812_02h26m58s_screenshot](assets/250812_02h26m58s_screenshot.png)
