<script setup lang="ts">
import type { CreateBlogPostInput } from '~/shared/types/models/blog'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BlogEditor } from '~/components/05.modules/blog'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import { useToast } from '~/shared/composables/use-toast'
import { AppRouteNames } from '~/shared/constants/routes'

const route = useRoute()
const router = useRouter()
const store = useBlogStore()
const toast = useToast()

const id = route.params.id as string
const form = ref<CreateBlogPostInput>({} as CreateBlogPostInput)

async function handleSave() {
  if (!form.value?.title?.trim() || !form.value?.content?.trim()) {
    toast.error('Заполните обязательные поля: заголовок и содержание')
    return
  }

  try {
    await store.updatePost({
      id,
      data: form.value,
    })

    toast.success('Статья обновлена')
    router.push({ name: AppRouteNames.BlogArticle, params: { slug: form.value.slug } })
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка обновления')
  }
}

function handleCancel() {
  router.back()
}

onMounted(async () => {
  await store.fetchById(id)

  if (store.currentPost) {
    form.value = JSON.parse(JSON.stringify(store.currentPost))
  }
  else {
    toast.error('Статья не найдена')
    router.push({ name: AppRouteNames.BlogList })
  }
})
</script>

<template>
  <div class="content-wrapper is-editor-page">
    <div v-if="store.isLoadingDetail" class="editor-loading-state">
      <Icon icon="mdi:loading" class="spinner" />
      <span>Загрузка статьи...</span>
    </div>
    <BlogEditor
      v-else
      v-model="form"
      is-editing
      :is-loading="store.isSaving"
      @save="handleSave"
      @cancel="handleCancel"
    />
  </div>
</template>

<style scoped lang="scss">
.content-wrapper.is-editor-page {
  max-width: 100%;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.editor-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 16px;
  color: var(--fg-secondary-color);
  font-size: 1rem;

  .spinner {
    font-size: 2.5rem;
    color: var(--fg-accent-color);
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
