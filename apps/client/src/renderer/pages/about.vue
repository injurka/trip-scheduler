<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { InteractiveGridPattern } from '~/components/02.shared/interactive-grid-pattern'
import { AppRoutePaths } from '~/shared/constants/routes'

const router = useRouter()
</script>

<template>
  <section class="wrapper">
    <div class="content">
      <div class="content-info">
        <h1>О проекте TripScheduler</h1>
        <p>
          Добро пожаловать! Меня зовут Иван, и этот проект родился из увлечения путешествиями и веб-разработкой. Мне хотелось создать удобный и визуально приятный инструмент для планирования поездок, где все детали — от маршрута до бюджета — были бы собраны в одном месте.
          <br><br>
          TripScheduler — это моё видение того, как технологии могут упростить организацию путешествий, сделав этот процесс более творческим и менее рутинным. Проект служит для меня площадкой для экспериментов с новыми технологиями и оттачивания навыков.
          <br><br>
          Если вы хотите узнать о технической реализации проекта, предложить улучшения или внести свой вклад, исходный код доступен на
          <span class="source">
            <a href="https://github.com/xsolare/trip-scheduler" target="_blank" rel="noopener noreferrer">GitHub</a>
          </span>
        </p>

        <div class="section">
          <h2>Важно знать</h2>
          <ul>
            <li>Проект создан для личного использования и в качестве портфолио.</li>
            <li>Это не коммерческий продукт, и некоторые функции могут находиться в разработке.</li>
            <li>Проект постоянно развивается, и я всегда открыт для обратной связи и предложений.</li>
          </ul>
        </div>
      </div>

      <InteractiveGridPattern
        :squares="[25, 25]"
        :width="35"
        :height="35"
        class="grid-pattern"
      />
    </div>

    <KitBtn
      variant="outlined"
      color="secondary"
      class="back"
      @click="router.push(AppRoutePaths.Root)"
    >
      Вернуться на главную
    </KitBtn>

    <BackgroundEffects />
  </section>
</template>

<style scoped lang="scss">
.grid-pattern {
  opacity: 0.4;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9;

  transform: skewY(-4deg);
  mask-image: radial-gradient(circle 500px at center, white, transparent);
  -webkit-mask-image: radial-gradient(circle 500px at center, white, transparent);
}

.wrapper {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 1rem;

  .content {
    position: relative;
    max-width: 800px;
    width: 100%;
    padding: 2rem;
    color: var(--fg-primary-color);
    line-height: 1.7;
    background-color: var(--bg-secondary-color-rgb-a-80);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: var(--r-l);
    border: 1px solid var(--border-secondary-color);
    box-shadow: var(--s-xl);
    overflow: hidden;

    &-info {
      z-index: 10;
      position: relative;
    }

    h1 {
      font-size: 2rem;
      color: var(--fg-accent-color);
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--border-accent-color);
      padding-bottom: 0.5rem;
    }

    h2 {
      font-size: 1.5rem;
      color: var(--fg-action-color);
      margin: 1.5rem 0 1rem 0;
    }

    p {
      margin: 0.5rem 0;
      color: var(--fg-secondary-color);
    }

    ul {
      padding-left: 1rem;
      li {
        margin: 0.5rem 0;
        font-size: 0.9rem;
        color: var(--fg-tertiary-color);
        &::marker {
          color: var(--border-accent-color);
        }
      }
    }

    .source {
      white-space: nowrap;
      display: inline-flex;
      padding: 2px 8px;
      align-items: center;
      gap: 4px;
      color: var(--fg-secondary-color);
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-s);
      transition: all 0.2s ease;

      a {
        color: var(--fg-secondary-color);
        text-decoration: none;
      }

      &:hover {
        color: var(--fg-accent-color);
        border-color: var(--border-accent-color);
        box-shadow: 0 0 0 1px var(--border-accent-color);

        a {
          color: var(--fg-accent-color);
        }
      }
    }
  }

  .section {
    margin-top: 2rem;
    padding: 1rem 1.5rem;
    background: var(--bg-tertiary-color);
    border-left: 3px solid var(--border-accent-color);
    border-radius: var(--r-m);

    > h2,
    ul {
      margin: 0;
    }
  }
}

.back {
  z-index: 10;
  margin-top: 1.5rem;
}

@include media-down(sm) {
  .content {
    padding: 1.5rem;

    h1 {
      font-size: 1.75rem;
    }

    h2 {
      font-size: 1.25rem;
    }
  }
}
</style>
