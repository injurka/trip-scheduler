<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { AsyncStateWrapper } from '~/components/02.shared/async-state-wrapper'
import { UserQuotaWidget } from '~/components/02.shared/user-quota-widget'
import { useQuota } from '~/components/05.modules/account/quota/composables/use-quota'
import { AppRouteNames } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

const authStore = useAuthStore()
const {
  plans,
  billingCycle,
  isLoading,
  fetchPlans,
  setBillingCycle,
} = useQuota()

const user = computed(() => authStore.user)

function formatPrice(price: number) {
  if (price === 0)
    return 'Бесплатно'

  return `${price.toLocaleString('ru-RU')} ₽`
}

onMounted(() => {
  if (plans.value.length === 0) {
    fetchPlans()
  }
})
</script>

<template>
  <div class="quota-page">
    <div class="quota-header">
      <h1>Управление тарифом</h1>
      <p>Здесь вы можете отслеживать использование ваших лимитов и выбрать подходящий тарифный план.</p>
    </div>

    <div v-if="user?.plan" class="current-usage">
      <h2 class="section-title">
        Текущее использование
      </h2>
      <div class="usage-widgets">
        <UserQuotaWidget
          title="Путешествия"
          icon="mdi:briefcase-outline"
          :current="user.currentTripsCount"
          :limit="user.plan.maxTrips"
          :to="{ name: AppRouteNames.TripList }"
          unit="items"
        />
        <UserQuotaWidget
          title="Хранилище"
          icon="mdi:database-outline"
          :current="user.currentStorageBytes"
          :limit="user.plan.maxStorageBytes"
          unit="bytes"
          :to="{ name: AppRouteNames.AccountStorage }"
        />
        <UserQuotaWidget
          title="LLM Токены"
          icon="mdi:robot-outline"
          :current="user.llmCreditsUsed"
          :limit="user.plan.monthlyLlmCredits"
          unit="tokens"
          :to="{ name: AppRouteNames.AccountQuota }"
        />
      </div>
    </div>

    <KitDivider />

    <div class="plans-section">
      <div class="plans-header">
        <h2 class="section-title">
          Тарифные планы
        </h2>
        <div class="billing-toggle">
          <span>Ежемесячно</span>
          <label class="switch">
            <input type="checkbox" :checked="billingCycle === 'yearly'" @change="setBillingCycle(($event.target as HTMLInputElement).checked ? 'yearly' : 'monthly')">
            <span class="slider" />
          </label>
          <span>
            Ежегодно <span class="discount-badge">-15%</span>
          </span>
        </div>
      </div>

      <AsyncStateWrapper :loading="isLoading" :data="plans">
        <template #success="{ data }">
          <div class="plans-grid">
            <div
              v-for="plan in data"
              :key="plan.id"
              class="plan-card"
              :class="{ 'is-current': plan.isCurrent, 'is-developing': plan.isDeveloping }"
            >
              <div v-if="plan.isDeveloping" class="dev-badge">
                <span>В разработке</span>
              </div>
              <div class="plan-card-header">
                <h3 class="plan-name">
                  {{ plan.name }}
                </h3>
                <div class="plan-price">
                  <span class="price-amount">{{ formatPrice(plan.price[billingCycle]) }}</span>
                  <span v-if="plan.price[billingCycle] > 0" class="price-period">/ {{ billingCycle === 'monthly' ? 'мес' : 'год' }}</span>
                </div>
                <p class="plan-description">
                  {{ plan.description }}
                </p>
              </div>
              <ul class="plan-features">
                <li v-for="feature in plan.features" :key="feature">
                  <Icon icon="mdi:check" class="feature-icon" />
                  <span>{{ feature }}</span>
                </li>
              </ul>
              <div class="plan-card-footer">
                <KitBtn
                  v-if="plan.isCurrent"
                  variant="outlined"
                  color="secondary"
                  disabled
                  style="width: 100%;"
                >
                  Ваш текущий тариф
                </KitBtn>
                <KitBtn v-else color="primary" style="width: 100%;" :disabled="plan.isDeveloping">
                  Лень делать
                  <!-- Перейти на {{ plan.name }} -->
                </KitBtn>
              </div>
            </div>
          </div>
        </template>
        <template #loading>
          <!-- Можно добавить скелетон для планов -->
          <div class="plans-grid">
            <div v-for="i in 3" :key="i" class="plan-card" />
          </div>
        </template>
      </AsyncStateWrapper>
    </div>
  </div>
</template>

<style scoped lang="scss">
.quota-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.quota-header {
  text-align: center;
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: var(--fg-primary-color);
  }
  p {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    max-width: 600px;
    margin: 0 auto;
  }
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--fg-primary-color);
}

.current-usage .usage-widgets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.plans-section .plans-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.billing-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.discount-badge {
  background-color: var(--bg-success-color);
  color: var(--fg-success-color);
  padding: 2px 6px;
  border-radius: var(--r-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  align-items: stretch;
}

.plan-card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  border-radius: var(--r-l);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &.is-developing {
    opacity: 0.6;
    filter: grayscale(50%);
  }

  &.is-current {
    border-color: var(--border-accent-color);
    box-shadow: 0 0 0 3px var(--bg-accent-color-translucent);
    transform: translateY(-4px);
  }

  .dev-badge {
    position: absolute;
    top: 20px;
    right: -45px;
    background-color: var(--fg-warning-color);
    color: var(--bg-primary-color);
    padding: 6px 40px;
    font-size: 0.8rem;
    font-weight: 600;
    transform: rotate(45deg);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &-header {
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-secondary-color);
  }

  .plan-name {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: var(--fg-primary-color);
  }

  .plan-price {
    margin-bottom: 1rem;
    .price-amount {
      font-size: 2rem;
      font-weight: 700;
      color: var(--fg-accent-color);
    }
    .price-period {
      font-size: 1rem;
      color: var(--fg-secondary-color);
    }
  }

  .plan-description {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    min-height: 40px;
  }

  .plan-features {
    list-style: none;
    padding: 1.5rem 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex-grow: 1;

    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
    }

    .feature-icon {
      color: var(--fg-success-color);
      font-size: 1.25rem;
    }
  }

  &-footer {
    margin-top: auto;
  }
}

/* Switch component styles */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary-color);
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--fg-accent-color);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--fg-accent-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}
</style>
