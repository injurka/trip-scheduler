<script setup lang="ts">
import { NavigationBack } from '~/components/02.shared/navigation-back'
</script>

<template>
  <div class="content-wrapper">
    <NavigationBack />
    <article class="legal-doc">
      <h1>Условия использования</h1>
      <p class="subtitle">
        Последнее обновление: 11 декабря 2025 г.
      </p>

      <section>
        <h2>1. Введение</h2>
        <p>
          Добро пожаловать в Trip Scheduler. Используя наш веб-сайт и сервисы, вы соглашаетесь соблюдать настоящие Условия использования. Если вы не согласны с этими условиями, пожалуйста, не используйте наш сервис.
        </p>
      </section>

      <section>
        <h2>2. Использование сервиса</h2>
        <p>
          Trip Scheduler предоставляет инструменты для планирования путешествий. Вы несете ответственность за сохранение конфиденциальности вашей учетной записи и пароля.
        </p>
        <ul>
          <li>Вы соглашаетесь использовать сервис только в законных целях.</li>
          <li>Запрещено использовать сервис для распространения вредоносного ПО или спама.</li>
          <li>Мы оставляем за собой право приостановить или удалить вашу учетную запись при нарушении условий.</li>
        </ul>
      </section>

      <section>
        <h2>3. Пользовательский контент</h2>
        <p>
          Вы сохраняете права на контент (фотографии, описания, маршруты), который вы загружаете в Trip Scheduler. Однако, загружая контент, вы предоставляете нам лицензию на его хранение и отображение в рамках функционирования сервиса.
        </p>
      </section>

      <section>
        <h2>4. Ограничение ответственности</h2>
        <p>
          Trip Scheduler предоставляется "как есть". Мы не гарантируем, что сервис будет работать без ошибок или перебоев. Мы не несем ответственности за потерю данных или любой другой ущерб, возникший в результате использования сервиса.
        </p>
      </section>

      <section>
        <h2>5. Изменения условий</h2>
        <p>
          Мы можем время от времени обновлять эти условия. Мы уведомим вас о существенных изменениях, разместив новые условия на этом сайте.
        </p>
      </section>

      <section>
        <h2>6. Контакты</h2>
        <p>
          Если у вас есть вопросы по поводу этих Условий, пожалуйста, свяжитесь с нами через GitHub репозиторий проекта.
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
