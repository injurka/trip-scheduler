<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PostDetailsView } from '~/components/05.modules/post'
import { usePostStore } from '~/components/05.modules/post/store/post.store'

const route = useRoute()
const router = useRouter()
const postStore = usePostStore()

const id = route.params.id as string
const post = computed(() => postStore.getPostById(id))

// Если пост не найден, редиректим
if (!post.value) {
  router.replace('/post/list')
}
</script>

<template>
  <section class="content-wrapper">
    <PostDetailsView v-if="post" :post="post" />
  </section>
</template>
