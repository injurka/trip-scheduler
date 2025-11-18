# Trip Scheduler Dockers

Этот проект содержит клиентское и серверное приложения, которые запускаются с помощью Docker.

## Требования

Убедитесь, что у вас установлены:
*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/) (обычно входит в состав Docker Desktop)

## Запуск приложения

1.  **Склонируйте репозиторий**
    ```bash
    git clone <адрес_вашего_репозитория>
    cd trip-scheduler
    ```

2.  **Подготовьте файлы**
    Убедитесь, что в корне проекта находятся три файла:
    *   `Dockerfile.server` — для сборки бэкенда.
    *   `Dockerfile.client` — для сборки фронтенда.
    *   `docker-compose.yml` — для управления обоими сервисами.

3.  **Соберите и запустите контейнеры**
    Выполните команду в корневой директории проекта:
    ```bash
    docker-compose up --build -d
    ```
    Эта команда соберет образы для клиента и сервера (флаг `--build`) и запустит их в фоновом режиме (флаг `-d`).

4.  **Проверка**
    После успешного запуска:
    *   **Клиент** будет доступен по адресу: `http://localhost:1420`
    *   **Сервер** будет доступен по адресу: `http://localhost:8080`

## Остановка приложения

Чтобы остановить и удалить контейнеры, выполните команду:
```bash
docker-compose down
```

## Полезные команды

*   **Просмотр логов в реальном времени:**
    ```bash
    docker-compose logs -f
    ```

*   **Пересобрать и перезапустить только один сервис (например, сервер):**
    ```bash
    docker-compose up --build -d server
    ```

*   **Получить доступ к командной строке внутри контейнера (для отладки):**
    ```bash
    # Для сервера
    docker-compose exec server sh

    # Для клиента (Nginx)
    docker-compose exec client sh
    ```

## Скрипты для сборки и запуска (без Docker Compose)

Этот раздел описывает альтернативный способ управления контейнерами с помощью отдельных `.sh` скриптов. Этот метод полезен для развертывания на сервере или когда требуется более детальный контроль над процессом.

### Подготовка к использованию скриптов

1.  **Создайте файлы**: В корневой директории вашего проекта создайте четыре файла с именами `build_client.sh`, `build_server.sh`, `run_client.sh`, `run_server.sh` и скопируйте в них соответствующее содержимое из блоков ниже.
2.  **Сделайте их исполняемыми**: Чтобы скрипты можно было запускать, дайте им права на выполнение с помощью команды:
    ```bash
    chmod +x build_client.sh build_server.sh run_client.sh run_server.sh
    ```
3.  **Запуск**: Каждый скрипт необходимо запускать, передавая ему **версию** в качестве первого аргумента. Например: `./build_client.sh v1.0.1`.

### 1. Скрипт для сборки клиента (`build_client.sh`)

Этот скрипт собирает Docker-образ для клиентского приложения, передавая необходимые переменные окружения на этапе сборки.

```bash
#!/bin/bash

# Проверяем, был ли передан аргумент с версией
if [ -z "$1" ]; then
  echo "Ошибка: Не указана версия."
  echo "Пример использования: ./build_client.sh v1.0.0"
  exit 1
fi

VERSION=$1

echo "--- Сборка образа клиента с тегом: trip-scheduler-client:$VERSION ---"

docker build -f ./docker/Dockerfile.client -t trip-scheduler-client:$VERSION . \
  --build-arg VITE_APP_SERVER_URL=https://api.trip-scheduler.ru \
  --build-arg VITE_APP_API_MODE=trpc \
  --build-arg VITE_APP_SERVER_STATIC_PATH=static/images \
  --build-arg VITE_MAPTILER_KEY=

echo "--- Сборка образа клиента trip-scheduler-client:$VERSION завершена успешно! ---"
```

### 2. Скрипт для сборки сервера (`build_server.sh`)

Этот скрипт переходит в директорию сервера (`apps/server`) и собирает его Docker-образ.

```bash
#!/bin/bash

# Проверяем, был ли передан аргумент с версией
if [ -z "$1" ]; then
  echo "Ошибка: Не указана версия."
  echo "Пример использования: ./build_server.sh v1.0.0"
  exit 1
fi

VERSION=$1

echo "--- Сборка образа сервера с тегом: trip-scheduler-server:$VERSION ---"

# Переходим в директорию сервера
cd apps/server

# Собираем образ
docker build -t trip-scheduler-server:$VERSION .

echo "--- Сборка образа сервера trip-scheduler-server:$VERSION завершена успешно! ---"
```

### 3. Скрипт для запуска сервера (`run_server.sh`)

Этот скрипт сначала останавливает и удаляет старый контейнер сервера (если он существует), а затем запускает новый из образа с указанной версией.

```bash
#!/bin/bash

# Проверяем, был ли передан аргумент с версией
if [ -z "$1" ]; then
  echo "Ошибка: Не указана версия."
  echo "Пример использования: ./run_server.sh v1.0.0"
  exit 1
fi

VERSION=$1
CONTAINER_NAME="trip-scheduler-server"

echo "--- Остановка и удаление существующего контейнера $CONTAINER_NAME (если он есть) ---"
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

echo "--- Запуск контейнера сервера с версией: $VERSION ---"

# Убедитесь, что путь к .env файлу и volume указаны верно относительно места запуска скрипта
docker run -d \
  --name $CONTAINER_NAME \
  -p 8080:8080 \
  --env-file ./apps/server/.env \
  -v "$HOME/static-data:/app/static" \
  --restart always \
  trip-scheduler-server:$VERSION

echo "--- Контейнер $CONTAINER_NAME успешно запущен! ---"
```

### 4. Скрипт для запуска клиента (`run_client.sh`)

Этот скрипт, аналогично серверному, останавливает и удаляет старый контейнер клиента и запускает новый.

```bash
#!/bin/bash

# Проверяем, был ли передан аргумент с версией
if [ -z "$1" ]; then
  echo "Ошибка: Не указана версия."
  echo "Пример использования: ./run_client.sh v1.0.0"
  exit 1
fi

VERSION=$1
CONTAINER_NAME="trip-scheduler-client"

echo "--- Остановка и удаление существующего контейнера $CONTAINER_NAME (если он есть) ---"
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

echo "--- Запуск контейнера клиента с версией: $VERSION ---"

docker run -d \
  -p 1420:1420 \
  --name $CONTAINER_NAME \
  --restart always \
  trip-scheduler-client:$VERSION

echo "--- Контейнер $CONTAINER_NAME успешно запущен! ---"
```


## Deploy

./build_server.sh v12
./build_client.sh v7

docker compose down

V_CLIENT=v7 V_SERVER=v12 docker compose up -d
