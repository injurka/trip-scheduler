<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitLogo } from '~/components/01.kit/kit-logo'
import { useOnboarding } from '~/shared/composables/use-onboarding'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  standalone?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  standalone: false,
})

const { completeOnboarding } = useOnboarding()

const router = props.standalone ? undefined : useRouter()
const sections = [
  {
    id: 'plan',
    number: '01',
    title: 'План и карта',
    badgeText: 'ПЛАН',
    icon: 'mdi:map-marker-path',
    badgeColor: 'orange',
  },
  {
    id: 'org',
    number: '02',
    title: 'Брони, документы и бюджет',
    badgeText: 'БРОНИ',
    icon: 'mdi:wallet-travel',
    badgeColor: 'emerald',
  },
  {
    id: 'memories',
    number: '03',
    title: 'Коллаж воспоминаний',
    badgeText: 'ПАМЯТЬ',
    icon: 'mdi:image-album',
    badgeColor: 'purple',
  },
]
const activeSectionId = ref('plan')
// Интерактивный демонстрационный чек-лист
const demoChecklist = ref([
  { id: 1, text: 'Билеты и ваучер отеля сохранены оффлайн', checked: true },
  { id: 2, text: 'Пауэрбанк и трекинговая обувь', checked: true },
  { id: 3, text: 'Аптечка и страховка', checked: true },
  { id: 4, text: 'Снять наличные в местной валюте', checked: false },
])
// Переключатель в блоке 02 (Бронирования / Финансы / Документы)
const activeOrgTab = ref<'booking' | 'finances' | 'checklist'>('booking')

const checkedCount = computed(() => demoChecklist.value.filter(item => item.checked).length)

function scrollToSection(id: string) {
  activeSectionId.value = id
  const el = document.getElementById(`section-${id}`)

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
function handleStartPlanning() {
  completeOnboarding()
  router?.push(AppRoutePaths.Trip.List)
}
function handleGoToAbout() {
  completeOnboarding()
  router?.push(AppRoutePaths.About)
}
function handleClose() {
  completeOnboarding()
  const returnUrl = props.standalone
    ? new URLSearchParams(window.location.search).get('returnUrl')
    : router?.currentRoute.value.query.returnUrl
  const target = typeof returnUrl === 'string'
    && /^\/(?![\\/])/.test(returnUrl)
    && !returnUrl.startsWith(AppRoutePaths.Onboarding)
    ? returnUrl
    : AppRoutePaths.Root

  if (props.standalone) {
    window.location.replace(target)
  }
  else {
    router?.replace(target)
  }
}
</script>

<template>
  <div class="onboarding-container">
    <!-- Пропуск вводного экрана -->
    <button
      class="skip-btn"
      type="button"
      title="Закрыть и перейти к приложению"
      aria-label="Пропустить"
      @click="handleClose"
    >
      <span class="close-label">Пропустить</span>
      <Icon :ssr="true" icon="mdi:close" class="close-icon" />
    </button>

    <!-- Верхний блок Hero -->
    <header class="hero-section">
      <div class="logo-area">
        <KitLogo text="TripScheduler" size="lg" />
      </div>

      <div class="hero-badge">
        <Icon :ssr="true" icon="mdi:compass-outline" class="badge-sparkle" />
        <span>Твой личный центр планирования поездок</span>
      </div>

      <h1 class="hero-title">
        Распланируй каждый шаг. <br class="title-break">
        Собери всё важное. <br class="title-break">
        Сохрани тёплые воспоминания.
      </h1>

      <p class="hero-description">
        Без каши из 10 таблиц в Excel, без потерянных в чатах броней и без забытых эмоций.
        Весь путь твоего путешествия — от первой идеи на карте до фотоколлажа с заметками после возвращения.
      </p>

      <!-- Навигация по стадиям (быстрые якоря) -->
      <nav class="stages-nav" aria-label="Шаги путешествия">
        <button
          v-for="s in sections"
          :key="s.id"
          class="stage-chip"
          :class="{ 'is-active': activeSectionId === s.id }"
          type="button"
          @click="scrollToSection(s.id)"
        >
          <span class="stage-num">{{ s.number }}</span>
          <Icon :ssr="true" :icon="s.icon" class="stage-icon" />
          <span class="stage-text">{{ s.title }}</span>
        </button>
      </nav>
    </header>

    <!-- Основное полотно шагов -->
    <main class="timeline-stream">
      <!-- ======================================================== -->
      <!-- ШАГ 1: План по дням, хайкинг и точки на карте            -->
      <!-- ======================================================== -->
      <section :id="`section-${sections[0].id}`" class="step-card" :class="`step--${sections[0].badgeColor}`">
        <div class="step-meta">
          <div class="step-badge">
            <span class="badge-num">01</span>
            <span class="badge-tag">{{ sections[0].badgeText }}</span>
          </div>
          <div class="step-connector" />
        </div>

        <div class="step-body">
          <div class="step-content">
            <div class="step-kicker">
              Шаг 01 • До поездки
            </div>
            <h2 class="step-title">
              Выгрузи всё из головы: план по дням, хайкинг и точки на карте
            </h2>

            <p class="step-narrative">
              Знакомо чувство, когда в голове крутится миллион мест — «хочу в ту секретную кофейню у моста»,
              «надо подняться на скалу», «а во вторник музей закрыт»? Обычно всё оседает в разрозненных
              заметках, скриншотах и ссылках из мессенджеров.
            </p>

            <p class="step-narrative">
              В <strong>TripScheduler</strong> ты просто раскладываешь поездку по полочкам: создавай план
              по дням, расставляй точки прямо на интерактивной карте, прокладывай пешие хайкинг-маршруты и оставляй
              полезные заметки.
            </p>

            <ul class="features-list">
              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:calendar-multiselect" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Последовательный план по дням и часам:</strong>
                  <span>Четкая картина поездки без суеты. Ты видишь, куда успеваешь, а где оставить свободное время на отдых.</span>
                </div>
              </li>

              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:map-marker-radius" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Точки и маршруты прямо на карте:</strong>
                  <span>Ставь маркеры локаций, строй пешие тропы, связывай точки в логичный трек и открывай навигацию в один клик.</span>
                </div>
              </li>

              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:notebook-edit-outline" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Заметки и лайфхаки к точкам:</strong>
                  <span>Пароли от Wi-Fi, часы работы, советы друзей: «здесь брать только фисташковый круассан» или «билеты на маяк брать заранее онлайн».</span>
                </div>
              </li>
            </ul>
          </div>

          <!-- UI-иллюстрация: Карточка дня + хайкинг с подблоком псевдокарты -->
          <div class="step-visual">
            <div class="ui-mockup plan-mockup">
              <div class="mockup-header">
                <div class="mockup-day-badge">
                  День 2 из 7
                </div>
                <div class="mockup-day-title">
                  Старый город, хайкинг и закат
                </div>
                <div class="mockup-day-meta">
                  <Icon :ssr="true" icon="mdi:map-marker-path" /> 3 локации • 6.2 км маршрута
                </div>
              </div>

              <div class="mockup-events-timeline">
                <!-- Точка 1 -->
                <div class="mockup-event-item">
                  <div class="event-time">
                    09:30
                  </div>
                  <div class="event-dot" />
                  <div class="event-card">
                    <div class="event-card-header">
                      <span class="event-name">Кофейня у Башни</span>
                      <span class="event-tag">Завтрак</span>
                    </div>
                    <p class="event-note">
                      Совет: балкон на втором этаже с видом на залив
                    </p>
                  </div>
                </div>

                <!-- Точка 2: Хайкинг с подблоком псевдокарты -->
                <div class="mockup-event-item is-hiking-item">
                  <div class="event-time">
                    13:00
                  </div>
                  <div class="event-dot is-hiking-dot" />
                  <div class="event-card hiking-card">
                    <div class="event-card-header">
                      <div class="hiking-title-group">
                        <Icon :ssr="true" icon="mdi:hiking" class="hiking-icon" />
                        <span class="event-name">Смотровая площадка на скале</span>
                      </div>
                      <span class="event-tag is-hiking-tag">Хайкинг</span>
                    </div>
                    <p class="event-note">
                      Подъем 45 мин, перепад высоты +340 м, чистый горный воздух
                    </p>

                    <!-- Подблок псевдокарты с точками и треком -->
                    <div class="pseudo-map-preview">
                      <div class="pseudo-map-topo-bg">
                        <!-- Векторные изолинии рельефа карты -->
                        <svg viewBox="0 0 360 120" class="topo-svg" preserveAspectRatio="none">
                          <path
                            d="M 0,90 Q 90,40 180,60 T 360,30"
                            stroke="currentColor"
                            fill="none"
                            stroke-width="1.2"
                            opacity="0.25"
                          />
                          <path
                            d="M 0,60 Q 80,10 190,40 T 360,10"
                            stroke="currentColor"
                            fill="none"
                            stroke-width="1.2"
                            opacity="0.3"
                          />
                          <path
                            d="M 0,30 Q 110,5 220,20 T 360,5"
                            stroke="currentColor"
                            fill="none"
                            stroke-width="1"
                            opacity="0.2"
                          />
                          <!-- Пунктирный трек хайкинга -->
                          <path
                            d="M 35,95 C 80,85 120,45 180,55 C 230,65 270,30 315,28"
                            stroke="#ff8856"
                            fill="none"
                            stroke-width="2.5"
                            stroke-dasharray="5 4"
                          />
                        </svg>
                      </div>

                      <!-- Точка старта на карте -->
                      <div class="map-pin pin-start" title="Старт тропы">
                        <Icon :ssr="true" icon="mdi:flag-checkered" />
                        <span class="pin-label">Старт</span>
                      </div>

                      <!-- Точка вершины с маркером -->
                      <div class="map-pin pin-peak" title="Смотровая площадка">
                        <div class="pin-radar" />
                        <Icon :ssr="true" icon="mdi:map-marker" class="peak-icon" />
                        <span class="pin-label">Пик 1250 м</span>
                      </div>

                      <!-- Плашка статуса карты -->
                      <div class="pseudo-map-bar">
                        <span class="map-badge">
                          <Icon :ssr="true" icon="mdi:crosshairs-gps" /> Точка на карте привязана
                        </span>
                        <span class="map-trail-info">Тропа орлов • 4.2 км</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Точка 3 -->
                <div class="mockup-event-item">
                  <div class="event-time">
                    19:30
                  </div>
                  <div class="event-dot is-accent" />
                  <div class="event-card is-accent">
                    <div class="event-card-header">
                      <span class="event-name">Закат на маяке</span>
                      <span class="event-tag is-accent">Must-see</span>
                    </div>
                    <p class="event-note">
                      Взять теплый свитер и термос с чаем
                    </p>

                    <!-- Подблок с 3 фотографиями к активности -->
                    <div class="activity-photos-strip">
                      <div class="activity-photo-card photo-sunset-1" title="Маяк на закате">
                        <div class="photo-bg-wrap">
                          <Icon :ssr="true" icon="mdi:lighthouse" class="photo-subject-icon" />
                        </div>
                        <span class="photo-mini-label">Маяк</span>
                      </div>

                      <div class="activity-photo-card photo-sunset-2" title="Золотые волны">
                        <div class="photo-bg-wrap">
                          <Icon :ssr="true" icon="mdi:waves" class="photo-subject-icon" />
                        </div>
                        <span class="photo-mini-label">Залив</span>
                      </div>

                      <div class="activity-photo-card photo-sunset-3" title="Вечернее солнце">
                        <div class="photo-bg-wrap">
                          <Icon :ssr="true" icon="mdi:weather-sunset-up" class="photo-subject-icon" />
                        </div>
                        <span class="photo-mini-label photo-more-chip">+3 фото</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- ШАГ 2: Бронирования, документы и финансы                 -->
      <!-- ======================================================== -->
      <section :id="`section-${sections[1].id}`" class="step-card" :class="`step--${sections[1].badgeColor}`">
        <div class="step-meta">
          <div class="step-badge">
            <span class="badge-num">02</span>
            <span class="badge-tag">{{ sections[1].badgeText }}</span>
          </div>
          <div class="step-connector" />
        </div>

        <div class="step-body">
          <div class="step-content">
            <div class="step-kicker">
              Шаг 02 • Организация и контроль
            </div>
            <h2 class="step-title">
              Всё под рукой: бронирования, документы и финансы
            </h2>

            <p class="step-narrative">
              Самое неприятное в путешествии — судорожно искать подтверждение брони отеля на стойке регистрации,
              переживать за потерянный билет на поезд или не понимать, сколько денег уже потрачено и сколько осталось.
            </p>

            <p class="step-narrative">
              В <strong>TripScheduler</strong> все организационные вопросы собраны в единый центр:
              храни брони отелей и транспорта, прикрепляй важные документы (страховки, билеты, ваучеры),
              веди прозрачный учет финансов и собирай вещи по удобным чеклистам. Всё доступно оффлайн даже без связи.
            </p>

            <ul class="features-list">
              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:bed-king-outline" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Бронирования отелей и транспорта:</strong>
                  <span>Даты заезда, адреса, номера рейсов, терминалы и контакты всегда под рукой в пару касаний.</span>
                </div>
              </li>

              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:wallet-outline" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Финансы и смета бюджета:</strong>
                  <span>Учитывай расходы по категориям (жилье, транспорт, еда, развлечения) в любой валюте и держи бюджет под контролем.</span>
                </div>
              </li>

              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:file-document-check-outline" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Документы и чек-листы сборов:</strong>
                  <span>Билеты, страховки и списки вещей в рюкзак. Работает оффлайн в горах, в поезде или в роуминге.</span>
                </div>
              </li>
            </ul>
          </div>

          <!-- UI-иллюстрация: Бронирования + Бюджет + Чек-лист с табами -->
          <div class="step-visual">
            <div class="ui-mockup org-mockup">
              <!-- Табы демо-панели -->
              <div class="org-tabs-header">
                <button
                  type="button"
                  class="org-tab-btn"
                  :class="{ 'is-active': activeOrgTab === 'booking' }"
                  @click="activeOrgTab = 'booking'"
                >
                  <Icon :ssr="true" icon="mdi:bed-king-outline" />
                  <span>Бронирования</span>
                </button>
                <button
                  type="button"
                  class="org-tab-btn"
                  :class="{ 'is-active': activeOrgTab === 'finances' }"
                  @click="activeOrgTab = 'finances'"
                >
                  <Icon :ssr="true" icon="mdi:chart-pie" />
                  <span>Финансы</span>
                </button>
                <button
                  type="button"
                  class="org-tab-btn"
                  :class="{ 'is-active': activeOrgTab === 'checklist' }"
                  @click="activeOrgTab = 'checklist'"
                >
                  <Icon :ssr="true" icon="mdi:format-list-checks" />
                  <span>Чек-лист</span>
                </button>
              </div>

              <!-- Стабильный контейнер для предотвращения прыжков высоты -->
              <div class="org-tabs-viewport">
                <!-- Контент таба: БРОНИРОВАНИЯ И ДОКУМЕНТЫ -->
                <div v-show="activeOrgTab === 'booking'" class="org-tab-content">
                  <!-- Карточка отеля -->
                  <div class="booking-item-card">
                    <div class="booking-card-top">
                      <div class="booking-hotel-info">
                        <span class="booking-type-badge">Отель • 4 ночи</span>
                        <h4 class="booking-hotel-name">
                          Villa Panorama & Spa
                        </h4>
                        <p class="booking-hotel-addr">
                          ул. Набережная, 18 • Заезд с 14:00
                        </p>
                      </div>
                      <span class="booking-status-tag">Подтверждено</span>
                    </div>
                    <div class="booking-card-bottom">
                      <span class="booking-dates">
                        <Icon :ssr="true" icon="mdi:calendar-range" /> 12 сент — 16 сент
                      </span>
                      <span class="booking-doc-link">
                        <Icon :ssr="true" icon="mdi:paperclip" /> Ваучер в кэше
                      </span>
                    </div>
                  </div>

                  <!-- Карточка авиа / ж/д рейса -->
                  <div class="transport-item-card">
                    <div class="transport-route">
                      <div class="t-point">
                        <span class="t-code">SVO</span>
                        <span class="t-city">Москва</span>
                      </div>

                      <div class="t-flight-track">
                        <div class="flight-track-meta">
                          <span class="flight-no">SU-1142</span>
                          <span class="flight-dot">•</span>
                          <span class="flight-dur">3ч 20м</span>
                        </div>
                        <div class="flight-track-line">
                          <span class="track-node is-start" />
                          <div class="track-bar">
                            <div class="track-plane-icon">
                              <Icon :ssr="true" icon="mdi:airplane" />
                            </div>
                          </div>
                          <span class="track-node is-end" />
                        </div>
                        <div class="flight-track-sub">
                          Прямой рейс
                        </div>
                      </div>

                      <div class="t-point align-right">
                        <span class="t-code">AER</span>
                        <span class="t-city">Сочи</span>
                      </div>
                    </div>
                    <div class="transport-meta-row">
                      <span>Вылет: 10:45 • Терминал B</span>
                      <span class="t-seat">Место 12A</span>
                    </div>
                  </div>
                </div>

                <!-- Контент таба: ФИНАНСЫ И БЮДЖЕТ -->
                <div v-show="activeOrgTab === 'finances'" class="org-tab-content">
                  <div class="finance-summary-box">
                    <div class="finance-top-stat">
                      <div class="stat-group">
                        <span class="stat-title">Бюджет поездки</span>
                        <span class="stat-val">148 500 ₽</span>
                      </div>
                      <div class="stat-group align-right">
                        <span class="stat-title">Остаток</span>
                        <span class="stat-val is-remain">42 300 ₽</span>
                      </div>
                    </div>

                    <!-- Полоса распределения расходов -->
                    <div class="finance-progress-bar">
                      <div class="bar-seg is-hotel" style="width: 45%" title="Жилье 45%" />
                      <div class="bar-seg is-transport" style="width: 30%" title="Транспорт 30%" />
                      <div class="bar-seg is-food" style="width: 15%" title="Еда 15%" />
                      <div class="bar-seg is-fun" style="width: 10%" title="Активности 10%" />
                    </div>

                    <!-- Список категорий -->
                    <div class="finance-categories-list">
                      <div class="finance-row">
                        <span class="cat-dot is-hotel" />
                        <span class="cat-name">Жилье и отели</span>
                        <span class="cat-sum">58 000 ₽</span>
                      </div>
                      <div class="finance-row">
                        <span class="cat-dot is-transport" />
                        <span class="cat-name">Транспорт и билеты</span>
                        <span class="cat-sum">44 500 ₽</span>
                      </div>
                      <div class="finance-row">
                        <span class="cat-dot is-food" />
                        <span class="cat-name">Еда и рестораны</span>
                        <span class="cat-sum">21 700 ₽</span>
                      </div>
                      <div class="finance-row">
                        <span class="cat-dot is-fun" />
                        <span class="cat-name">Экскурсии и сувениры</span>
                        <span class="cat-sum">12 000 ₽</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Контент таба: ЧЕК-ЛИСТ СБОРОВ -->
                <div v-show="activeOrgTab === 'checklist'" class="org-tab-content">
                  <div class="mockup-checklist">
                    <div class="checklist-header">
                      <span class="checklist-title">Чек-лист перед вылетом</span>
                      <span class="checklist-counter">{{ checkedCount }} из {{ demoChecklist.length }} собрано</span>
                    </div>

                    <div class="checklist-items">
                      <label
                        v-for="item in demoChecklist"
                        :key="item.id"
                        class="check-row"
                        :class="{ 'is-checked': item.checked }"
                      >
                        <input
                          v-model="item.checked"
                          type="checkbox"
                          class="check-input"
                        >
                        <span class="check-box-custom">
                          <Icon v-if="item.checked" ssr icon="mdi:check" />
                        </span>
                        <span class="check-text">{{ item.text }}</span>
                      </label>
                    </div>

                    <div class="checklist-footer-note">
                      <Icon :ssr="true" icon="mdi:cloud-check-outline" />
                      <span>Сохранено для оффлайн-доступа</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- ШАГ 3: Воспоминания: коллаж из фото и текстовые пометки  -->
      <!-- ======================================================== -->
      <section :id="`section-${sections[2].id}`" class="step-card" :class="`step--${sections[2].badgeColor}`">
        <div class="step-meta">
          <div class="step-badge">
            <span class="badge-num">03</span>
            <span class="badge-tag">{{ sections[2].badgeText }}</span>
          </div>
          <div class="step-connector" />
        </div>

        <div class="step-body">
          <div class="step-content">
            <div class="step-kicker">
              Шаг 03 • После поездки
            </div>
            <h2 class="step-title">
              Поездка закончилась, а эмоции остались: коллаж воспоминаний и заметки
            </h2>

            <p class="step-narrative">
              Обычно после возвращения сотни фотографий оседают мертвым грузом в галерее телефона,
              перемешиваясь со случайными скриншотами, чеками и рабочими документами. Со временем стираются
              названия посещенных мест, маршрут забывается, а эмоции тускнеют.
            </p>

            <p class="step-narrative">
              В <strong>TripScheduler</strong> твой завершенный план получает вторую жизнь: он превращается
              в живой фотоколлаж с личными текстовыми пометками. Загружай фотографии и видео прямо к тем дням
              и точкам, где они были сделаны, собирай общую карту воспоминаний и пересматривай галерею путешествия
              спустя годы.
            </p>

            <ul class="features-list">
              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:image-album" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Коллаж из фото по дням и местам:</strong>
                  <span>Кадры аккуратно сгруппированы по дням маршрута. Никакого визуального мусора — только яркие моменты приключения.</span>
                </div>
              </li>

              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:comment-quote-outline" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Текстовые пометки и впечатления:</strong>
                  <span>Записывай живые эмоции, смешные фразы из поездки, рецепты понравившихся блюд и памятные мысли прямо к фотографиям.</span>
                </div>
              </li>

              <li class="feature-item">
                <div class="feature-icon-wrapper">
                  <Icon :ssr="true" icon="mdi:map-legend" class="feature-icon" />
                </div>
                <div class="feature-info">
                  <strong>Общая интерактивная карта воспоминаний:</strong>
                  <span>Смотри на карте мира все покоренные вершины, уютные города и пляжи, в которых ты побывал.</span>
                </div>
              </li>
            </ul>
          </div>

          <!-- UI-иллюстрация: Настоящий фотоколлаж с текстовыми заметками -->
          <div class="step-visual">
            <div class="ui-mockup memories-mockup">
              <!-- Заголовок дня воспоминаний -->
              <div class="memories-group-header">
                <div class="memories-day-chip">
                  <Icon :ssr="true" icon="mdi:calendar-check" />
                  <span>День 3 • 14 сентября</span>
                </div>
                <div class="memories-stats-tag">
                  <Icon :ssr="true" icon="mdi:camera" /> 18 фото • 2 заметки
                </div>
              </div>

              <!-- Сетка-коллаж из фото разного формата с художественными очерками сцен -->
              <div class="photo-collage-grid">
                <!-- Главное фото 1: Пик Орлов на рассвете -->
                <div class="collage-item collage-hero">
                  <div class="photo-surface photo-bg-mountain">
                    <!-- Художественный очерк/скетч рассвета в горах -->
                    <div class="photo-sketch is-mountain">
                      <svg
                        class="photo-sketch-svg"
                        viewBox="0 0 200 188"
                        preserveAspectRatio="xMidYMid slice"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <radialGradient
                            id="onboarding-sun-glow"
                            cx="50%"
                            cy="50%"
                            r="50%"
                          >
                            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.95" />
                            <stop offset="35%" stop-color="#f59e0b" stop-opacity="0.5" />
                            <stop offset="70%" stop-color="#ea580c" stop-opacity="0.2" />
                            <stop offset="100%" stop-color="#ea580c" stop-opacity="0" />
                          </radialGradient>
                          <linearGradient
                            id="onboarding-mount-far"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop offset="0%" stop-color="#4338ca" stop-opacity="0.55" />
                            <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.8" />
                          </linearGradient>
                          <linearGradient
                            id="onboarding-mount-near"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop offset="0%" stop-color="#312e81" stop-opacity="0.85" />
                            <stop offset="100%" stop-color="#0f0c29" stop-opacity="0.95" />
                          </linearGradient>
                        </defs>

                        <!-- Восходящее солнце -->
                        <circle
                          cx="130"
                          cy="78"
                          r="32"
                          fill="url(#onboarding-sun-glow)"
                        />
                        <circle
                          cx="130"
                          cy="78"
                          r="11"
                          fill="#fffbeb"
                          opacity="0.95"
                        />

                        <!-- Парящие орлы в утреннем небе -->
                        <path
                          d="M48,46 Q54,41 61,45 Q68,41 74,46 Q68,44 61,48 Q54,44 48,46 Z"
                          fill="rgba(255, 255, 255, 0.75)"
                        />
                        <path
                          d="M78,35 Q82,31 87,34 Q92,31 96,35 Q92,33 87,36 Q82,33 78,35 Z"
                          fill="rgba(255, 255, 255, 0.55)"
                        />

                        <!-- Дальний горный хребет -->
                        <polygon
                          points="0,126 36,98 75,122 120,84 165,116 200,92 200,188 0,188"
                          fill="url(#onboarding-mount-far)"
                        />

                        <!-- Средний горный хребет -->
                        <polygon
                          points="0,146 32,125 72,94 114,136 156,106 200,142 200,188 0,188"
                          fill="url(#onboarding-mount-near)"
                        />

                        <!-- Главный пик Орлов на переднем плане -->
                        <polygon
                          points="20,188 82,72 144,188"
                          fill="#0f0c29"
                        />
                        <!-- Теневая сторона пика -->
                        <polygon
                          points="82,72 96,188 144,188"
                          fill="rgba(0, 0, 0, 0.4)"
                        />
                        <!-- Очертание гребня вершины -->
                        <path
                          d="M82,72 L96,188"
                          stroke="rgba(255, 255, 255, 0.3)"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                        <!-- Снежная шапка на вершине -->
                        <polygon
                          points="82,72 73,92 80,88 85,93 92,87 82,72"
                          fill="rgba(255, 255, 255, 0.85)"
                        />

                        <!-- Утренний туман и облака в долине -->
                        <path
                          d="M-10,142 Q35,130 80,140 T170,134 T210,142 L210,188 L-10,188 Z"
                          fill="rgba(255, 255, 255, 0.12)"
                        />
                        <path
                          d="M-10,158 Q45,148 100,156 T195,150 T210,158 L210,188 L-10,188 Z"
                          fill="rgba(255, 255, 255, 0.18)"
                        />
                      </svg>
                    </div>

                    <div class="photo-tag-top">
                      <span class="rating-pill">
                        <Icon :ssr="true" icon="mdi:star" class="star-icon" /> 5.0
                      </span>
                    </div>
                    <div class="photo-caption-bar">
                      <Icon :ssr="true" icon="mdi:map-marker" />
                      <span>Пик Орлов • Рассвет в облаках</span>
                    </div>
                  </div>
                </div>

                <!-- Фото 2: Старая кофейня -->
                <div class="collage-item collage-square">
                  <div class="photo-surface photo-bg-cafe">
                    <!-- Художественный очерк/скетч кофейни -->
                    <div class="photo-sketch is-cafe">
                      <svg
                        class="photo-sketch-svg"
                        viewBox="0 0 140 90"
                        preserveAspectRatio="xMidYMid slice"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <radialGradient
                            id="onboarding-cafe-lamp"
                            cx="50%"
                            cy="50%"
                            r="50%"
                          >
                            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.85" />
                            <stop offset="50%" stop-color="#ea580c" stop-opacity="0.3" />
                            <stop offset="100%" stop-color="#ea580c" stop-opacity="0" />
                          </radialGradient>
                          <radialGradient
                            id="onboarding-cup-steam"
                            cx="50%"
                            cy="50%"
                            r="50%"
                          >
                            <stop offset="0%" stop-color="#f97316" stop-opacity="0.4" />
                            <stop offset="100%" stop-color="#7c2d12" stop-opacity="0" />
                          </radialGradient>
                        </defs>

                        <!-- Декоративные маркизы кофейни сверху -->
                        <path
                          d="M6,0 Q18,14 30,0 Q42,14 54,0 Q66,14 78,0 Q90,14 102,0 Q114,14 126,0 Q138,14 144,0"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.18)"
                          stroke-width="1.2"
                        />

                        <!-- Винтажный фонарь кофейни слева -->
                        <line
                          x1="22"
                          y1="0"
                          x2="22"
                          y2="24"
                          stroke="rgba(255, 255, 255, 0.3)"
                          stroke-width="1"
                        />
                        <polygon points="14,28 30,28 26,24 18,24" fill="rgba(251, 191, 36, 0.6)" />
                        <circle
                          cx="22"
                          cy="32"
                          r="16"
                          fill="url(#onboarding-cafe-lamp)"
                        />

                        <!-- Теплое свечение вокруг чашки -->
                        <circle
                          cx="92"
                          cy="46"
                          r="28"
                          fill="url(#onboarding-cup-steam)"
                        />

                        <!-- Блюдце -->
                        <ellipse
                          cx="92"
                          cy="62"
                          rx="28"
                          ry="6.5"
                          fill="rgba(255, 255, 255, 0.15)"
                          stroke="rgba(255, 255, 255, 0.4)"
                          stroke-width="1"
                        />

                        <!-- Чашка кофе -->
                        <path
                          d="M74,42 L78,57 C79,61 84,62 92,62 C100,62 105,61 106,57 L110,42 Z"
                          fill="rgba(255, 255, 255, 0.28)"
                          stroke="rgba(255, 255, 255, 0.55)"
                          stroke-width="1"
                        />
                        <!-- Ручка чашки -->
                        <path
                          d="M109,44 C116,45 116,54 107,55"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.55)"
                          stroke-width="1.4"
                          stroke-linecap="round"
                        />
                        <!-- Поверхность эспрессо/кофе -->
                        <ellipse
                          cx="92"
                          cy="42"
                          rx="17"
                          ry="4"
                          fill="#3e1a12"
                          stroke="rgba(251, 191, 36, 0.6)"
                          stroke-width="0.8"
                        />

                        <!-- Завитки ароматного пара -->
                        <path
                          d="M86,35 Q82,26 87,20 T84,8"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.5)"
                          stroke-width="1.3"
                          stroke-linecap="round"
                        />
                        <path
                          d="M93,34 Q97,25 93,17 T96,6"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.65)"
                          stroke-width="1.3"
                          stroke-linecap="round"
                        />
                        <path
                          d="M100,36 Q103,28 98,22 T101,11"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.4)"
                          stroke-width="1.3"
                          stroke-linecap="round"
                        />
                      </svg>
                    </div>

                    <div class="photo-tag-top">
                      <span class="photo-time-pill">10:45</span>
                    </div>
                    <div class="photo-caption-bar">
                      <Icon :ssr="true" icon="mdi:map-marker" />
                      <span>Старая кофейня</span>
                    </div>
                  </div>
                </div>

                <!-- Фото 3: Бухта маяка -->
                <div class="collage-item collage-square">
                  <div class="photo-surface photo-bg-bay">
                    <!-- Художественный очерк/скетч бухты и маяка -->
                    <div class="photo-sketch is-bay">
                      <svg
                        class="photo-sketch-svg"
                        viewBox="0 0 140 90"
                        preserveAspectRatio="xMidYMid slice"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <linearGradient
                            id="onboarding-lighthouse-beam"
                            x1="100%"
                            y1="0%"
                            x2="0%"
                            y2="80%"
                          >
                            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.85" />
                            <stop offset="35%" stop-color="#38bdf8" stop-opacity="0.35" />
                            <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
                          </linearGradient>
                        </defs>

                        <!-- Ночное небо: полумесяц и звезды -->
                        <path
                          d="M20,12 A6,6 0 0 0 24,22 A8,8 0 0 1 20,12 Z"
                          fill="#e0f2fe"
                          opacity="0.75"
                        />
                        <circle
                          cx="44"
                          cy="14"
                          r="1.2"
                          fill="#fff"
                          opacity="0.65"
                        />
                        <circle
                          cx="68"
                          cy="18"
                          r="0.9"
                          fill="#fff"
                          opacity="0.5"
                        />
                        <circle
                          cx="56"
                          cy="28"
                          r="0.8"
                          fill="#fff"
                          opacity="0.4"
                        />

                        <!-- Световой луч маяка -->
                        <polygon
                          points="114,24 0,34 0,66 114,27"
                          fill="url(#onboarding-lighthouse-beam)"
                        />

                        <!-- Скалистый утес справа -->
                        <polygon
                          points="100,90 95,58 105,50 118,53 140,48 140,90"
                          fill="#042f2e"
                          opacity="0.92"
                        />
                        <path
                          d="M95,58 L105,50 L118,53 L140,48"
                          fill="none"
                          stroke="rgba(45, 212, 191, 0.4)"
                          stroke-width="1"
                        />

                        <!-- Башня маяка на утесе -->
                        <rect
                          x="110"
                          y="46"
                          width="13"
                          height="4"
                          rx="0.5"
                          fill="#134e4a"
                        />
                        <polygon points="112,46 114,28 119,28 121,46" fill="#f0fdfa" opacity="0.9" />
                        <polygon points="112.7,40 113.3,34 119.7,34 120.3,40" fill="#0f766e" opacity="0.95" />
                        <rect
                          x="111"
                          y="26"
                          width="11"
                          height="2"
                          fill="#042f2e"
                        />
                        <rect
                          x="113"
                          y="20"
                          width="7"
                          height="6"
                          fill="#fef08a"
                          opacity="0.95"
                        />
                        <path d="M112,20 Q116.5,14 121,20 Z" fill="#042f2e" />
                        <line
                          x1="116.5"
                          y1="14"
                          x2="116.5"
                          y2="11"
                          stroke="#042f2e"
                          stroke-width="1"
                        />

                        <!-- Морские волны бухты -->
                        <path
                          d="M6,66 Q20,62 34,66 T62,66 T90,66"
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.5)"
                          stroke-width="1.3"
                          stroke-linecap="round"
                        />
                        <path
                          d="M16,74 Q30,70 44,74 T72,74 T98,74"
                          fill="none"
                          stroke="rgba(45, 212, 191, 0.4)"
                          stroke-width="1.3"
                          stroke-linecap="round"
                        />
                        <path
                          d="M8,82 Q24,78 40,82 T72,82 T104,82"
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.3)"
                          stroke-width="1.3"
                          stroke-linecap="round"
                        />
                      </svg>
                    </div>

                    <div class="photo-tag-top">
                      <span class="photo-time-pill">19:20</span>
                    </div>
                    <div class="photo-caption-bar">
                      <Icon :ssr="true" icon="mdi:map-marker" />
                      <span>Бухта маяка</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Текстовые пометки и впечатления дня -->
              <div class="memories-notes-stream">
                <div class="memory-note-bubble">
                  <div class="note-quote-icon">
                    <Icon :ssr="true" icon="mdi:format-quote-open" />
                  </div>
                  <div class="note-body">
                    <p class="note-text">
                      «Проснулись в 5 утра, чтобы успеть на скалу к рассвету. Ветер сдувал термос,
                      но когда туман внизу начал светиться розовым — это было абсолютное счастье.»
                    </p>
                    <span class="note-meta">Заметка к точке «Пик Орлов» • 06:45</span>
                  </div>
                </div>

                <div class="memory-note-bubble is-small">
                  <div class="note-quote-icon">
                    <Icon :ssr="true" icon="mdi:message-text-outline" />
                  </div>
                  <div class="note-body">
                    <p class="note-text">
                      «Обязательно вернуться сюда в октябре, когда деревья станут золотыми!»
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Финальный блок Call to Action -->
    <footer class="onboarding-cta">
      <div class="cta-inner">
        <div class="cta-glow" />
        <div class="cta-icon-wrapper">
          <Icon :ssr="true" icon="mdi:compass-rose" class="cta-compass" />
        </div>

        <h2 class="cta-title">
          Готов превратить мысли в настоящее приключение?
        </h2>

        <p class="cta-subtitle">
          Будь то спонтанная вылазка на выходные в соседний город или долгожданное большое путешествие мечты.
          Начни с чистого листа или импортируй готовые заметки.
        </p>

        <div class="cta-actions">
          <a
            v-if="props.standalone"
            :href="AppRoutePaths.Trip.List"
            class="kit-btn kit-btn--solid kit-btn--color-primary kit-btn--size-lg cta-primary-btn"
            @click="completeOnboarding"
          >
            <span class="kit-btn-content">
              <Icon :ssr="true" icon="mdi:plus-circle-outline" />
              <span>Начать планировать</span>
            </span>
          </a>
          <KitBtn
            v-else
            variant="solid"
            color="primary"
            size="lg"
            class="cta-primary-btn"
            @click="handleStartPlanning"
          >
            <Icon :ssr="true" icon="mdi:plus-circle-outline" />
            <span>Начать планировать</span>
          </KitBtn>

          <a
            v-if="props.standalone"
            :href="AppRoutePaths.About"
            class="kit-btn kit-btn--outlined kit-btn--color-secondary kit-btn--size-lg cta-secondary-btn"
            @click="completeOnboarding"
          >
            <span class="kit-btn-content">
              <Icon :ssr="true" icon="mdi:information-outline" />
              <span>О проекте TripScheduler</span>
            </span>
          </a>
          <KitBtn
            v-else
            variant="outlined"
            color="secondary"
            size="lg"
            class="cta-secondary-btn"
            @click="handleGoToAbout"
          >
            <Icon :ssr="true" icon="mdi:information-outline" />
            <span>О проекте TripScheduler</span>
          </KitBtn>
        </div>

        <button
          class="cta-skip-link"
          type="button"
          @click="handleClose"
        >
          Понятно, перейти к приложению
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.onboarding-container {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: calc(60px + var(--safe-area-inset-top, 0px)) 24px calc(80px + var(--safe-area-inset-bottom, 0px));
  color: var(--fg-primary-color);
  font-family: inherit;

  @media (max-width: 768px) {
    padding: calc(56px + var(--safe-area-inset-top, 0px)) 16px calc(60px + var(--safe-area-inset-bottom, 0px));
  }

  @media (max-width: 480px) {
    padding: calc(52px + var(--safe-area-inset-top, 0px)) 12px calc(48px + var(--safe-area-inset-bottom, 0px));
  }
}

.skip-btn {
  position: fixed;
  top: calc(24px + var(--safe-area-inset-top, 0px));
  right: calc(24px + var(--safe-area-inset-right, 0px));
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: rgba(var(--bg-primary-color-rgb), 0.85);
  border: 1px solid var(--border-primary-color);
  border-radius: 9999px;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.95);
    transform: translateY(-1px);
  }

  .close-icon {
    font-size: 1.1rem;
  }

  @media (max-width: 600px) {
    top: calc(16px + var(--safe-area-inset-top, 0px));
    right: calc(16px + var(--safe-area-inset-right, 0px));
    padding: 6px 12px;
  }
}

// Hero section
.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 0 60px;
}

.logo-area {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 24px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background-color: rgba(255, 136, 86, 0.12);
  border: 1px solid rgba(255, 136, 86, 0.3);
  border-radius: 9999px;
  color: var(--fg-accent-color);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 20px;

  .badge-sparkle {
    font-size: 1rem;
  }
}

.hero-title {
  font-size: clamp(2rem, 4.5vw, 3.25rem);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--fg-primary-color);
  margin-bottom: 20px;
  max-width: 900px;
}

.hero-description {
  font-size: clamp(1rem, 1.8vw, 1.2rem);
  line-height: 1.65;
  color: var(--fg-secondary-color);
  max-width: 760px;
  margin-bottom: 36px;
}

// Навигационные чипы этапов
.stages-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  max-width: 880px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
    gap: 8px;
  }
}

.stage-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.6);
  border: 1px solid var(--border-secondary-color);
  border-radius: 9999px;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  .stage-num {
    font-family: var(--font-mono, monospace);
    font-weight: 700;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .stage-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .stage-text {
    white-space: nowrap;
  }

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--bg-secondary-color-rgb), 0.9);
  }

  &.is-active {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: rgba(255, 136, 86, 0.1);
  }

  @media (max-width: 600px) {
    width: 100%;
    box-sizing: border-box;
    justify-content: flex-start;
    padding: 10px 16px;
    font-size: 0.85rem;

    .stage-text {
      flex: 1;
      text-align: left;
    }
  }
}

// Стрим шагов
.timeline-stream {
  display: flex;
  flex-direction: column;
  gap: 64px;
  margin-top: 20px;

  @media (max-width: 768px) {
    gap: 48px;
    margin-top: 16px;
  }
}

.step-card {
  position: relative;
  display: flex;
  gap: 32px;
  scroll-margin-top: 100px;

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 16px;
  }

  @media (max-width: 768px) {
    gap: 20px;
    padding-bottom: 48px;
    border-bottom: 1px solid var(--border-secondary-color);

    &:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }
  }
}

.step-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 84px;

  @media (max-width: 900px) {
    flex-direction: row;
    width: 100%;
    align-items: center;
    gap: 12px;
  }
}

// Исправление переполнения текста на бейджиках
.step-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 76px;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 18px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.85);
  border: 1px solid var(--border-primary-color);
  box-shadow: var(--s-md);
  text-align: center;
  z-index: 2;

  .badge-num {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1;
    font-family: var(--font-mono, monospace);
  }

  .badge-tag {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
    margin-top: 4px;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    flex-direction: row;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 9999px;

    .badge-num {
      font-size: 0.95rem;
    }

    .badge-tag {
      margin-top: 0;
    }
  }
}

.step-connector {
  flex: 1;
  width: 2px;
  margin-top: 16px;
  background: linear-gradient(180deg, var(--border-primary-color) 0%, transparent 100%);

  @media (max-width: 900px) {
    display: none;
  }
}

.step--orange .badge-num {
  color: #ff8856;
}
.step--emerald .badge-num {
  color: #27ae60;
}
.step--purple .badge-num {
  color: #e879f9;
}

.step-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  flex: 1;
  padding: 32px;
  background-color: rgba(var(--bg-primary-color-rgb), 0.5);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l, 20px);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--s-lg);
  transition: border-color 0.3s ease;

  &:hover {
    border-color: rgba(var(--border-primary-color-rgb), 0.6);
  }

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 24px;
  }

  @media (max-width: 768px) {
    padding: 0;
    gap: 24px;
    background: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;

    &:hover {
      border-color: transparent;
    }
  }
}

.step-content {
  display: flex;
  flex-direction: column;
}

.step-kicker {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-accent-color);
  margin-bottom: 8px;
}

.step-title {
  font-size: clamp(1.4rem, 2.5vw, 1.85rem);
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 16px;
  color: var(--fg-primary-color);
}

.step-narrative {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--fg-secondary-color);
  margin-bottom: 14px;

  strong {
    color: var(--fg-primary-color);
  }
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  list-style: none;
  padding: 0;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.feature-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.8);
  border: 1px solid var(--border-primary-color);
  flex-shrink: 0;
  color: var(--fg-accent-color);
}

.feature-icon {
  font-size: 1.25rem;
}

.feature-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.925rem;
  line-height: 1.5;

  strong {
    color: var(--fg-primary-color);
    font-weight: 600;
  }

  span {
    color: var(--fg-secondary-color);
  }
}

// Визуальные макеты UI (интерактивные карточки)
.step-visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ui-mockup {
  width: 100%;
  max-width: 480px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.7);
  border: 1px solid var(--border-primary-color);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--s-md);
  user-select: none;
  box-sizing: border-box;

  @media (max-width: 600px) {
    padding: 14px 10px;
    border-radius: 14px;
  }
}

// ==========================================
// МАКЕТ 1: План дня + Хайкинг с псевдокартой
// ==========================================
.plan-mockup {
  .mockup-header {
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }

  .mockup-day-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 9999px;
    background-color: rgba(255, 136, 86, 0.15);
    color: #ff8856;
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .mockup-day-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin-bottom: 4px;
  }

  .mockup-day-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);
  }
}

.mockup-events-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (max-width: 600px) {
    gap: 10px;
  }
}

.mockup-event-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .event-time {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-tertiary-color);
    width: 44px;
    padding-top: 4px;
    flex-shrink: 0;
  }

  .event-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--border-primary-color);
    margin-top: 12px;
    flex-shrink: 0;

    &.is-hiking-dot {
      background-color: #3b82f6;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.7);
    }

    &.is-accent {
      background-color: var(--fg-accent-color);
      box-shadow: 0 0 10px var(--fg-accent-color);
    }
  }

  .event-card {
    flex: 1;
    min-width: 0;
    background-color: rgba(var(--bg-primary-color-rgb), 0.6);
    border: 1px solid var(--border-secondary-color);
    border-radius: 12px;
    padding: 10px 12px;

    &.is-accent {
      border-color: rgba(255, 136, 86, 0.4);
      background-color: rgba(255, 136, 86, 0.08);
    }
  }

  .event-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
  }

  .event-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.25;
  }

  .event-tag {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: rgba(var(--bg-secondary-color-rgb), 0.9);
    color: var(--fg-secondary-color);
    flex-shrink: 0;
    white-space: nowrap;

    &.is-hiking-tag {
      background-color: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      font-weight: 600;
    }

    &.is-accent {
      background-color: #ff8856;
      color: #fff;
      font-weight: 600;
    }
  }

  .event-note {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    margin: 0;
    line-height: 1.35;
  }

  @media (max-width: 600px) {
    gap: 8px;

    .event-time {
      width: 36px;
      font-size: 0.72rem;
      padding-top: 2px;
    }

    .event-dot {
      margin-top: 7px;
    }

    .event-card {
      padding: 8px 10px;
    }

    .event-name {
      font-size: 0.84rem;
    }

    .event-note {
      font-size: 0.74rem;
    }
  }
}

// Подблок с 3 фотографиями активности
.activity-photos-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.activity-photo-card {
  position: relative;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4px 6px;
  box-shadow: var(--s-sm);

  &.photo-sunset-1 {
    background: linear-gradient(180deg, rgba(26, 16, 20, 0.25) 0%, rgba(15, 10, 14, 0.85) 100%), #4a252c;
  }

  &.photo-sunset-2 {
    background: linear-gradient(180deg, rgba(28, 20, 14, 0.25) 0%, rgba(16, 11, 7, 0.85) 100%), #482d18;
  }

  &.photo-sunset-3 {
    background: linear-gradient(180deg, rgba(20, 16, 28, 0.25) 0%, rgba(11, 8, 18, 0.85) 100%), #2f203d;
  }

  .photo-bg-wrap {
    display: flex;
    justify-content: flex-end;
    color: rgba(255, 255, 255, 0.5);

    .photo-subject-icon {
      font-size: 1.05rem;
    }
  }

  .photo-mini-label {
    font-size: 0.62rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background-color: rgba(0, 0, 0, 0.55);
    padding: 1px 5px;
    border-radius: 4px;
    width: fit-content;
    backdrop-filter: blur(4px);

    &.photo-more-chip {
      background-color: rgba(var(--bg-primary-color-rgb), 0.8);
      color: var(--fg-secondary-color);
      border: 1px solid var(--border-secondary-color);
    }
  }
}

// Карточка хайкинга с подблоком псевдокарты
.hiking-card {
  border-color: rgba(59, 130, 246, 0.35) !important;
  background-color: rgba(59, 130, 246, 0.05) !important;

  .hiking-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;

    .hiking-icon {
      color: #60a5fa;
      font-size: 1.1rem;
      flex-shrink: 0;
    }
  }
}

.pseudo-map-preview {
  position: relative;
  width: 100%;
  height: 100px;
  margin-top: 10px;
  border-radius: 8px;
  overflow: hidden;
  background: radial-gradient(circle at 75% 30%, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);

  @media (max-width: 600px) {
    height: 86px;
    margin-top: 8px;
  }
}

.pseudo-map-topo-bg {
  position: absolute;
  inset: 0;
  color: #38bdf8;
  opacity: 0.8;

  .topo-svg {
    width: 100%;
    height: 100%;
  }
}

.map-pin {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  z-index: 2;

  &.pin-start {
    bottom: 12px;
    left: 20px;
    color: #94a3b8;
  }

  &.pin-peak {
    top: 14px;
    right: 24px;
    color: #ff8856;

    .peak-icon {
      font-size: 1.25rem;
      filter: drop-shadow(0 2px 6px rgba(255, 136, 86, 0.6));
    }

    .pin-radar {
      position: absolute;
      top: 2px;
      left: 1px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: rgba(255, 136, 86, 0.35);
      animation: pinRadar 2s infinite ease-out;
    }
  }

  .pin-label {
    background-color: rgba(15, 23, 42, 0.8);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.pseudo-map-bar {
  position: absolute;
  bottom: 6px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.65rem;
  color: #e2e8f0;
  background-color: rgba(15, 23, 42, 0.75);
  padding: 3px 8px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  z-index: 3;

  @media (max-width: 600px) {
    bottom: 4px;
    left: 4px;
    right: 4px;
    padding: 2px 6px;
    font-size: 0.58rem;
  }

  .map-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #38bdf8;
    font-weight: 600;
  }

  .map-trail-info {
    color: #94a3b8;
  }
}

// ==========================================
// МАКЕТ 2: Бронирования, Финансы, Чек-лист
// ==========================================
.org-mockup {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.org-tabs-header {
  display: flex;
  background-color: rgba(var(--bg-primary-color-rgb), 0.6);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  gap: 4px;

  @media (max-width: 600px) {
    padding: 3px;
    gap: 3px;
  }
}

.org-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 8px;
  background: none;
  border: none;
  border-radius: 7px;
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
  }

  &.is-active {
    background-color: rgba(var(--bg-secondary-color-rgb), 0.95);
    color: #27ae60;
    box-shadow: var(--s-sm);
  }

  @media (max-width: 600px) {
    padding: 6px 3px;
    gap: 3px;
    font-size: 0.68rem;

    svg {
      font-size: 0.85rem;
    }
  }
}

// Стабильный вьюпорт одинаковой высоты для всех табов — предотвращает прыжки верстки
.org-tabs-viewport {
  position: relative;
  min-height: 268px;
  display: flex;
  flex-direction: column;

  @media (max-width: 600px) {
    min-height: 275px;
  }
}

.org-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}

// Карточка отеля
.booking-item-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(var(--bg-primary-color-rgb), 0.8) 0%, rgba(39, 174, 96, 0.07) 100%);
  border: 1px solid rgba(39, 174, 96, 0.35);
  border-radius: 12px;
  padding: 10px 12px;
}

.booking-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;

  .booking-type-badge {
    font-size: 0.65rem;
    font-weight: 700;
    color: #27ae60;
    text-transform: uppercase;
  }

  .booking-hotel-name {
    font-size: 0.925rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 2px 0;
  }

  .booking-hotel-addr {
    font-size: 0.725rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .booking-status-tag {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    background-color: rgba(39, 174, 96, 0.15);
    color: #27ae60;
  }
}

.booking-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.725rem;
  color: var(--fg-tertiary-color);
  border-top: 1px dashed var(--border-secondary-color);
  padding-top: 6px;

  .booking-dates,
  .booking-doc-link {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .booking-doc-link {
    color: #27ae60;
  }
}

// Карточка рейса
.transport-item-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: rgba(var(--bg-primary-color-rgb), 0.6);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 10px 12px;
}

.transport-route {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;

  .t-point {
    display: flex;
    flex-direction: column;
    min-width: 50px;

    &.align-right {
      align-items: flex-end;
      text-align: right;
    }

    .t-code {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      line-height: 1.1;
      color: var(--fg-primary-color);
    }

    .t-city {
      font-size: 0.68rem;
      color: var(--fg-tertiary-color);
      margin-top: 1px;
    }
  }

  .t-flight-track {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px 0;

    .flight-track-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
      margin-bottom: 4px;

      .flight-no {
        font-family: var(--font-mono, monospace);
        color: var(--fg-primary-color);
      }

      .flight-dot {
        opacity: 0.5;
      }

      .flight-dur {
        color: var(--fg-secondary-color);
        font-weight: 500;
      }
    }

    .flight-track-line {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;
      height: 14px;
      margin-top: 2px;

      .track-node {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--fg-accent-color);
        flex-shrink: 0;
        z-index: 2;
      }

      .track-bar {
        position: relative;
        flex: 1;
        height: 1.5px;
        background-color: var(--fg-accent-color);
        opacity: 0.6;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .track-plane-icon {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        background-color: rgba(var(--bg-secondary-color-rgb), 0.95);
        color: var(--fg-accent-color);
        font-size: 1.05rem;
        border-radius: 4px;
        z-index: 3;
      }
    }

    .flight-track-sub {
      font-size: 0.6rem;
      color: var(--fg-tertiary-color);
      margin-top: 3px;
    }
  }
}

.transport-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.725rem;
  color: var(--fg-secondary-color);
  border-top: 1px solid var(--border-secondary-color);
  padding-top: 6px;

  .t-seat {
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

@media (max-width: 600px) {
  .booking-item-card,
  .transport-item-card {
    padding: 8px 10px;
  }

  .booking-card-top {
    .booking-hotel-name {
      font-size: 0.875rem;
    }
    .booking-hotel-addr {
      font-size: 0.68rem;
    }
  }

  .booking-card-bottom {
    font-size: 0.68rem;
    padding-top: 4px;
  }

  .transport-route {
    gap: 8px;

    .t-point {
      min-width: 44px;

      .t-code {
        font-size: 1.05rem;
      }
      .t-city {
        font-size: 0.65rem;
      }
    }

    .t-flight-track {
      padding: 2px 2px 0;

      .flight-track-meta {
        font-size: 0.6rem;
        gap: 3px;
        margin-bottom: 2px;
      }
    }
  }

  .transport-meta-row {
    font-size: 0.68rem;
    padding-top: 4px;
  }
}

// Вкладка Финансов
.finance-summary-box {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: rgba(var(--bg-primary-color-rgb), 0.7);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 12px 14px;
}

.finance-top-stat {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;

  .stat-group {
    display: flex;
    flex-direction: column;

    &.align-right {
      align-items: flex-end;
    }

    .stat-title {
      font-size: 0.65rem;
      text-transform: uppercase;
      color: var(--fg-tertiary-color);
    }

    .stat-val {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--fg-primary-color);

      &.is-remain {
        color: #27ae60;
      }
    }
  }
}

.finance-progress-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
  background-color: var(--border-secondary-color);

  .bar-seg {
    height: 100%;

    &.is-hotel {
      background-color: #3b82f6;
    }
    &.is-transport {
      background-color: #ff8856;
    }
    &.is-food {
      background-color: #27ae60;
    }
    &.is-fun {
      background-color: #e879f9;
    }
  }
}

.finance-categories-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.finance-row {
  display: flex;
  align-items: center;
  font-size: 0.725rem;

  .cat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 8px;

    &.is-hotel {
      background-color: #3b82f6;
    }
    &.is-transport {
      background-color: #ff8856;
    }
    &.is-food {
      background-color: #27ae60;
    }
    &.is-fun {
      background-color: #e879f9;
    }
  }

  .cat-name {
    flex: 1;
    color: var(--fg-secondary-color);
  }

  .cat-sum {
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    color: var(--fg-primary-color);
  }
}

// Чек-лист сборов
.mockup-checklist {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: rgba(var(--bg-primary-color-rgb), 0.6);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 12px 14px;

  .checklist-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .checklist-counter {
    font-size: 0.7rem;
    color: #27ae60;
    font-family: var(--font-mono, monospace);
  }
}

.checklist-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--fg-secondary-color);
  transition: color 0.2s ease;

  .check-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .check-box-custom {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid var(--border-primary-color);
    background-color: var(--bg-primary-color);
    color: #fff;
    font-size: 0.75rem;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  &.is-checked {
    color: var(--fg-muted-color);
    text-decoration: line-through;

    .check-box-custom {
      background-color: #27ae60;
      border-color: #27ae60;
    }
  }

  &:hover {
    color: var(--fg-primary-color);
  }
}

.checklist-footer-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  color: #27ae60;
  border-top: 1px dashed var(--border-secondary-color);
  padding-top: 6px;
  margin-top: 4px;
}

// ==========================================
// МАКЕТ 3: Воспоминания — Коллаж из фото
// ==========================================
.memories-mockup {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memories-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-secondary-color);

  .memories-day-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    white-space: nowrap;
    min-width: 0;
  }

  .memories-stats-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: #e879f9;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    .memories-day-chip {
      font-size: 0.78rem;
      gap: 4px;
    }

    .memories-stats-tag {
      font-size: 0.68rem;
      gap: 3px;
    }
  }
}

// Сетка настоящего фотоколлажа
.photo-collage-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  grid-template-rows: repeat(2, 90px);
  gap: 8px;
}

.collage-item {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);

    .photo-sketch {
      opacity: 1;
    }
  }

  &.collage-hero {
    grid-row: span 2;
  }
}

.photo-surface {
  padding: 8px;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  &.photo-bg-mountain {
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.6) 100%),
      radial-gradient(ellipse at bottom, #b45309 0%, #1e1b4b 70%);
  }

  &.photo-bg-cafe {
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.65) 100%),
      radial-gradient(ellipse at top, #ea580c 0%, #3f1d24 70%);
  }

  &.photo-bg-bay {
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.65) 100%),
      radial-gradient(ellipse at center, #0284c7 0%, #064e3b 70%);
  }
}

// Художественные очерки / скетчи фотографий
.photo-sketch {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
  opacity: 0.88;
  transition: opacity 0.25s ease;

  .photo-sketch-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.photo-tag-top {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .rating-pill {
    display: flex;
    align-items: center;
    gap: 3px;
    background-color: rgba(0, 0, 0, 0.5);
    color: #fbbf24;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 9999px;
    backdrop-filter: blur(4px);

    .star-icon {
      font-size: 0.75rem;
    }
  }

  .photo-time-pill {
    display: inline-flex;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.62rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 9999px;
    backdrop-filter: blur(4px);
    font-family: var(--font-mono, monospace);
    letter-spacing: 0.02em;
  }
}

.photo-caption-bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Заметки к воспоминаниям
.memories-notes-stream {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.memory-note-bubble {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background-color: rgba(var(--bg-primary-color-rgb), 0.75);
  border: 1px solid rgba(232, 121, 249, 0.25);
  border-radius: 10px;
  padding: 10px 12px;

  &.is-small {
    background-color: rgba(var(--bg-primary-color-rgb), 0.5);
    border-color: var(--border-secondary-color);
    padding: 8px 12px;
  }

  @media (max-width: 600px) {
    padding: 8px 10px;
    gap: 8px;

    &.is-small {
      padding: 6px 10px;
    }
  }

  .note-quote-icon {
    color: #e879f9;
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .note-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .note-text {
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--fg-primary-color);
    margin: 0;
    font-style: italic;
  }

  .note-meta {
    font-size: 0.68rem;
    color: var(--fg-tertiary-color);
    font-family: var(--font-mono, monospace);
  }
}

// Финальный Call to Action блок
.onboarding-cta {
  position: relative;
  margin-top: 80px;
  border-radius: 24px;
  border: 1px solid rgba(255, 136, 86, 0.35);
  background: linear-gradient(
    180deg,
    rgba(var(--bg-secondary-color-rgb), 0.85) 0%,
    rgba(var(--bg-primary-color-rgb), 0.95) 100%
  );
  padding: 48px 24px;
  text-align: center;
  overflow: hidden;
  box-shadow: var(--s-xl);

  @media (max-width: 600px) {
    padding: 36px 16px;
    margin-top: 48px;
  }
}

.cta-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 680px;
  margin: 0 auto;
}

.cta-glow {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 136, 86, 0.25) 0%, transparent 70%);
  pointer-events: none;
  z-index: 1;
}

.cta-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background-color: rgba(255, 136, 86, 0.15);
  border: 1px solid rgba(255, 136, 86, 0.4);
  color: var(--fg-accent-color);
  font-size: 2rem;
  margin-bottom: 20px;
}

.cta-title {
  font-size: clamp(1.5rem, 3.2vw, 2.2rem);
  font-weight: 800;
  line-height: 1.25;
  color: var(--fg-primary-color);
  margin-bottom: 14px;
}

.cta-subtitle {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--fg-secondary-color);
  margin-bottom: 28px;
}

.cta-actions a {
  text-decoration: none;
}

.cta-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.cta-primary-btn {
  font-weight: 600;
  padding: 0 28px;
}

.cta-secondary-btn {
  font-weight: 500;
  padding: 0 24px;
}

.cta-skip-link {
  margin-top: 20px;
  background: none;
  border: none;
  color: var(--fg-tertiary-color);
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
  }
}

@keyframes pinRadar {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}
</style>
