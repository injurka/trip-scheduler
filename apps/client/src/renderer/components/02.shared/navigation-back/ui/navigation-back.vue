<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  href?: string
}

const props = defineProps<Props>()
const router = props.href ? undefined : useRouter()

function goBack() {
  if (typeof window !== 'undefined' && window.history.state?.back) {
    router?.back()
  }
  else {
    void router?.push(AppRoutePaths.Root)
  }
}
</script>

<template>
  <div class="navigation-back-container">
    <a v-if="href" :href="href" class="navigation-back-btn static-back">
      <Icon :ssr="true" icon="mdi:arrow-left" /> Назад
    </a>
    <KitBtn
      v-else
      class="navigation-back-btn"
      icon="mdi:arrow-left"
      variant="outlined"
      color="secondary"
      @click="goBack"
    >
      Назад
    </KitBtn>
  </div>
</template>

<style scoped lang="scss">
.static-back {
  color: var(--fg-secondary-color);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.navigation-back-container {
  display: flex;
}

.navigation-back-btn {
  border: 1px solid transparent !important;
  opacity: 0.5;
  padding: 6px;

  &:hover {
    opacity: 1;
  }
}
</style>
