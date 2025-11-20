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
