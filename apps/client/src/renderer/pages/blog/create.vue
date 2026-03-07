<script setup lang="ts">
import type { CreateBlogPostInput } from '~/shared/types/models/blog'
import { BlogEditor } from '~/components/05.modules/blog'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import { AppRouteNames } from '~/shared/constants/routes'

const store = useBlogStore()
const router = useRouter()
const toast = useToast()

const form = ref<Partial<CreateBlogPostInput>>({
  title: '',
  slug: '',
  content: '',
  excerpt: '',
  published: true,
})

async function handleSave() {
  if (!form.value.title || !form.value.content) {
    toast.error('Заполните обязательные поля')
    return
  }

  try {
    const newPost = await store.createPost(form.value as CreateBlogPostInput)
    if (newPost) {
      toast.success('Статья создана')
      router.push({ name: AppRouteNames.BlogArticle, params: { slug: newPost.slug } })
    }
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка создания')
  }
}

function handleCancel() {
  router.back()
}
</script>

<template>
  <div class="content-wrapper">
    <h1>Новая запись</h1>
    <BlogEditor
      v-model="form"
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
