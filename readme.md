# 📅 Trip Scheduler: Планировщик Путешествий

**Trip Scheduler** — это комплексное решение для создания идеальных маршрутов путешествий и сохранения воспоминаний. Это кросс-платформенное приложение, состоящее из десктопного клиента на базе **Electron**, мобильных приложений на **Capacitor** и веб-версии (PWA), с акцентом на офлайн-работу и синхронизацию данных.

[![Vue.js](https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vue.js)](https://vuejs.org/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?logo=electron)](https://www.electronjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-5968FF?logo=capacitor)](https://capacitorjs.com/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono)](https://hono.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-2B81C8?logo=trpc)](https://trpc.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Bun](https://img.shields.io/badge/Bun-black?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)

![250812_02h26m13s_screenshot](assets/250812_02h26m13s_screenshot.png)

## 🌟 Ключевые возможности

-   **🗺️ Детальное планирование:** Создавайте поездки, разбивайте их по дням и добавляйте активности с привязкой ко времени и местам на карте (`OpenLayers`).
-   **✈️ Кросс-платформенность:** Полноценная работа на **десктопе** (Linux, Windows, macOS через Electron), в **веб-браузере** (PWA) и на **мобильных устройствах** (Android, iOS через Capacitor).
-   **✍️ Богатый контент:** Используйте встроенный Markdown-редактор (`Milkdown`) для заметок и добавляйте галереи изображений к активностям.
-   **✈️ Умные бронирования:** Добавляйте информацию о перелетах, отелях и поездах. Используйте **AI-парсер** для автоматического распознавания данных из билетов.
-   **✅ Чек-листы и финансы:** Создавайте списки вещей и ведите учет расходов с привязкой к категориям и валютам.
-   **📸 Лента воспоминаний:** Автоматически создавайте хронологию путешествия из фотографий с геолокацией и EXIF-данными.
-   **🌍 Социальные функции:** Создавайте **сообщества**, делитесь маршрутами и исследуйте **интересные места** в разных городах.
-   **📡 Офлайн-режим:** Веб-версия использует Service Worker для кэширования, обеспечивая доступ к данным без сети.
-   **✨ Современный интерфейс:** Интуитивно понятный и адаптивный интерфейс с кастомизацией тем и перетаскиванием (drag-and-drop) активностей.
-   **🛠️ Гибкая архитектура:** Фронтенд построен на принципах **Vertical Slice Architecture**, а бэкенд предоставляет типобезопасный API благодаря tRPC.

## 🏗️ Архитектура проекта

Проект организован как монорепозиторий, управляемый с помощью `Bun Workspaces`.

-   **`apps/client` (Клиентское приложение)**
    -   **Фреймворк:** Vue 3 (Composition API), Vite.
    -   **Десктопная версия:** Собрана с помощью Electron, обеспечивая нативную интеграцию с ОС.
    -   **Мобильная версия:** Использует Capacitor для сборки под Android и iOS.
    -   **Управление состоянием:** Pinia для централизованного и модульного управления состоянием.
    -   **Архитектура:** Код организован по слоям (`01.kit`, `02.shared`, `03.domain`, `04.features`, `05.modules`, `06.layouts`) для обеспечения низкой связанности и высокой переиспользуемости.

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

## 🚀 Технологический стек

-   **Фронтенд:** Vue 3, Vite, TypeScript, Pinia, Vue Router, Sass (SCSS), OpenLayers, Milkdown, Storybook.
-   **Бэкенд:** Hono, tRPC, Drizzle ORM, TypeScript, Resend (для email), Sharp (для изображений).
-   **Десктоп:** Electron.
-   **Мобильные:** Capacitor.
-   **База данных:** PostgreSQL (сервер).
-   **Среда выполнения и инструменты:** Bun, Docker, ESLint, Prometheus, Grafana.

## 🛠️ Установка и запуск

### Предварительные требования

-   [Bun](https://bun.sh/) (v1.1.0 или выше).
-   [Docker](https://www.docker.com/get-started/) и Docker Compose.
-   [Зависимости для Electron](https://www.electronjs.org/docs/latest/development/build-instructions-linux) (для вашей ОС).

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

2.  **Запустите клиент (Electron или Веб):**

    *   Для **десктопного приложения Electron**:
        ```bash
        bun --cwd ./apps/client electron:dev
        ```
    *   Для **веб-версии**:
        ```bash
        bun --cwd ./apps/client dev
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
| `bun electron:dev`                     | Запуск десктопного приложения Electron в режиме разработки.            | `client`       |
| `bun storybook:dev`                    | Запуск Storybook для просмотра UI-компонентов.                         | `client`       |
| **Сборка**                             |                                                                        |                |
| `bun build`                            | Сборка production-версии сервера и клиента.                            | `root`         |
| `bun build`                            | Сборка production-версии сервера.                                      | `server`       |
| `bun build`                            | Сборка production-версии веб-клиента.                                  | `client`       |
| `bun electron:build`                   | Сборка исполняемого файла десктопного приложения.                      | `client`       |
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
| **Мобильная сборка (Capacitor)**       |                                                                        |                |
| `bun cap:sync`                         | Синхронизация веб-сборки с нативными проектами (Android/iOS).           | `client`       |
| `bun cap:open:android`                 | Открытие проекта в Android Studio.                                     | `client`       |

## 📜 Пример приложения

![250812_02h26m58s_screenshot](assets/250812_02h26m58s_screenshot.png)
