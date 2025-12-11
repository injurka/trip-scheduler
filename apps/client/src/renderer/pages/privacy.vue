<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back'
</script>

<template>
  <div class="content-wrapper">
    <NavigationBack />
    <article class="legal-doc">
      <h1>Политика конфиденциальности</h1>
      <p class="subtitle">
        Последнее обновление: 11 декабря 2025 г.
      </p>

      <section>
        <h2>1. Общие положения</h2>
        <p>
          Мы уважаем вашу конфиденциальность и стремимся защищать ваши личные данные. Эта Политика конфиденциальности объясняет, как мы собираем, используем и защищаем информацию при использовании Trip Scheduler.
        </p>
      </section>

      <section>
        <h2>2. Сбор данных</h2>
        <p>
          Мы собираем только ту информацию, которая необходима для работы сервиса:
        </p>
        <ul>
          <li><strong>Учетная запись:</strong> Имя, адрес электронной почты и (опционально) фото профиля при регистрации.</li>
          <li><strong>Контент путешествий:</strong> Данные о ваших поездках, маршрутах, заметках и загруженных файлах.</li>
          <li><strong>Технические данные:</strong> IP-адрес, тип браузера и данные cookie для обеспечения безопасности и улучшения работы сайта.</li>
        </ul>
      </section>

      <section>
        <h2>3. Использование данных</h2>
        <p>
          Ваши данные используются исключительно для предоставления функционала Trip Scheduler: создание и хранение маршрутов, синхронизация между устройствами и предоставление доступа к совместному планированию (если вы используете эту функцию).
        </p>
      </section>

      <section>
        <h2>4. Хранение и защита</h2>
        <p>
          Мы принимаем разумные меры безопасности для защиты ваших данных от несанкционированного доступа. Пароли хранятся в зашифрованном виде. Файлы хранятся в защищенном облачном хранилище.
        </p>
      </section>

      <section>
        <h2>5. Передача третьим лицам</h2>
        <p>
          Мы не продаем и не передаем ваши личные данные третьим лицам в маркетинговых целях. Мы можем использовать сторонние сервисы (например, для хостинга или аналитики), которые обрабатывают данные в соответствии с их политиками конфиденциальности.
        </p>
      </section>

      <section>
        <h2>6. Удаление данных</h2>
        <p>
          Вы имеете право в любой момент удалить свою учетную запись и все связанные с ней данные через настройки профиля.
        </p>
      </section>
    </article>
  </div>
</template>

<style scoped lang="scss">
.content-wrapper {
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.legal-doc {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 32px;
  color: var(--fg-primary-color);

  h1 {
    font-size: 2rem;
    margin: 0 0 8px;
    color: var(--fg-primary-color);
  }

  .subtitle {
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
    margin-bottom: 32px;
  }

  section {
    margin-bottom: 24px;

    h2 {
      font-size: 1.25rem;
      margin-bottom: 12px;
      color: var(--fg-accent-color);
    }

    p {
      line-height: 1.6;
      margin-bottom: 12px;
      color: var(--fg-secondary-color);
    }

    ul {
      list-style-type: disc;
      padding-left: 24px;
      color: var(--fg-secondary-color);

      li {
        margin-bottom: 8px;
        line-height: 1.5;
      }
    }
  }
}

@include media-down(sm) {
  .legal-doc {
    padding: 20px;
  }
}
</style>
