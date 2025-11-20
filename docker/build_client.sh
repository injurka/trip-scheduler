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
  --build-arg VITE_APP_SERVER_STATIC_PATH=static/images \
  --build-arg VITE_APP_MOCK_MODE=false \
  --build-arg VITE_MAPTILER_KEY=kOcWHJKOfFqZI78YXBfH

echo "--- Сборка образа клиента trip-scheduler-client:$VERSION завершена успешно! ---"
