<script setup lang="ts">
import type { CreateBlogPostInput } from '~/shared/types/models/blog'
import { useRouter } from 'vue-router'
import { BlogEditor } from '~/components/05.modules/blog'
import { useBlogStore } from '~/components/05.modules/blog/store/blog.store'
import { useToast } from '~/shared/composables/use-toast'
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
  if (!form.value.title?.trim() || !form.value.content?.trim()) {
    toast.error('Заполните обязательные поля: заголовок и содержание')
    return
  }

  try {
    const newPost = await store.createPost(form.value as CreateBlogPostInput)
    if (newPost) {
      toast.success('Статья опубликована')
      router.push({ name: AppRouteNames.BlogArticle, params: { slug: newPost.slug } })
    }
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка создания')
  }
}

function handleCancel() {
  router.push({ name: AppRouteNames.BlogList })
}
</script>

<template>
  <div class="content-wrapper is-editor-page">
    <BlogEditor
      v-model="form"
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
</style>
