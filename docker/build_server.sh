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
