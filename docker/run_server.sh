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

docker run -d \
  --name $CONTAINER_NAME \
  --network trip-net \
  -p 8080:8080 \
  --env-file ./apps/server/.env \
  -v "$HOME/static-data:/usr/src/app/static" \
  --restart always \
  trip-scheduler-server:$VERSION

echo "--- Контейнер $CONTAINER_NAME успешно запущен! ---"
