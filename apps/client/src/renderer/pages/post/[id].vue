<script setup lang="ts">
import type { PostDetail } from '~/shared/types/models/post'
import { useRoute, useRouter } from 'vue-router'
import { PostDetailsView } from '~/components/05.modules/post'
import { usePostStore } from '~/components/05.modules/post/store/post.store'
import PostDetailsSkeleton from '~/components/05.modules/post/ui/details/skeletons/post-details-skeleton.vue'
import PostTimelineSkeleton from '~/components/05.modules/post/ui/details/skeletons/post-timeline-skeleton.vue'
import { AppRoutePaths } from '~/shared/constants/routes'

const route = useRoute()
const router = useRouter()
const postStore = usePostStore()

const id = route.params.id as string

const post = ref<PostDetail | undefined>(postStore.getPostById(id))
const isLoadingDetails = ref(false)
const hasDetails = computed(() => !!post.value?.stages)

const isMapPinned = ref(false)

onMounted(async () => {
  isLoadingDetails.value = true

  const fetchedPost = await postStore.fetchPostById(id)

  isLoadingDetails.value = false

  if (!fetchedPost) {
    post.value = undefined
    console.error('Пост не найден')
    router.replace(AppRoutePaths.Post.List)
  }
  else {
    post.value = fetchedPost
  }
})
</script>

<template>
  <section class="content-wrapper" :class="{ 'is-wide': isMapPinned }">
    <PostDetailsSkeleton v-if="!post" />

    <PostDetailsView v-else :post="post" @map-pinned-change="isMapPinned = $event">
      <template #timeline>
        <PostTimelineSkeleton v-if="isLoadingDetails && !hasDetails" />
      </template>
    </PostDetailsView>
  </section>
</template>

<style scoped lang="scss">
.content-wrapper {
  width: 100%;
  padding: 0;
  transition: max-width 0.4s ease;

  &.is-wide {
    max-width: 2400px !important;
  }
}
</style>
