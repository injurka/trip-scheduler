<script setup lang="ts">
import { BlogEditor } from '~/components/05.modules/blog'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import { AppRouteNames } from '~/shared/constants/routes'

const route = useRoute()
const router = useRouter()
const store = useBlogStore()
const toast = useToast()

const id = route.params.id as string
const form = ref<any>({})

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

async function handleSave() {
  try {
    await store.updatePost({ id, ...form.value })
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
</script>

<template>
  <div class="content-wrapper">
    <h1>Редактирование записи</h1>
    <div v-if="store.isLoadingDetail">
      Загрузка...
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

<style scoped>
.content-wrapper {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
