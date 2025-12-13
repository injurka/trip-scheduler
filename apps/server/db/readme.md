### Способ 1: Быстрый запуск (Docker CLI)

Выполните эту команду в терминале. Она скачает последнюю версию и запустит базу данных в памяти (данные пропадут после остановки контейнера):

```bash
docker run --rm --name surrealdb -p 8000:8000 surrealdb/surrealdb:latest start --user root --pass root
```

Если вы хотите, чтобы **данные сохранялись** в файл на вашем диске, используйте эту команду:

```bash
# Создаем папку для данных
mkdir -p mydata

# Запускаем с монтированием тома
docker run --rm --name surrealdb \
  -p 8000:8000 \
  -v $(pwd)/mydata:/mydata \
  surrealdb/surrealdb:latest start --user root --pass root file:/mydata/surreal.db
```

---

### Способ 2: Удобный (Docker Compose) — Рекомендую

Создайте файл `docker-compose.yml` в корне вашего проекта. Это позволит зафиксировать настройки и запускать базу одной командой.

```yaml
version: '3.8'

services:
  surrealdb:
    image: surrealdb/surrealdb:latest
    container_name: trip-scheduler-surrealdb
    ports:
      - '8000:8000'
    # Запуск сервера с логином/паролем и сохранением в файл
    command: start --log trace --user root --pass root file:/mydata/surreal.db
    volumes:
      - ./surreal_data:/mydata # Папка surreal_data появится в вашем проекте
```

Запуск:

```bash
docker-compose up -d
```
