<script setup lang="ts">
import type { PostMedia, WhitelistUser } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { onClickOutside, useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendar } from '~/components/01.kit/kit-calendar'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useRequest } from '~/plugins/request'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { MOCK_COUNTRY_DATA } from '../../data/countries'
import { usePostDraftStore } from '../../store/post-draft.store'
import { EPostRequestKeys, usePostStore } from '../../store/post.store'
import PostDetailsView from '../details/post-details-view.vue'
import StageEditor from './stage-editor.vue'
import MediaLibraryPicker from './tools/media-library-picker.vue'
import MediaTimelineImport from './tools/media-timeline-import.vue'
import PostMapPicker from './tools/post-map-picker.vue'

const getDraftKey = (id?: string) => id ? `trip_scheduler_post_draft_${id}` : 'trip_scheduler_post_draft_new'

function clearNewDraftAlias(postId: string) {
  try {
    const cached = JSON.parse(localStorage.getItem(getDraftKey()) || 'null')
    if (cached?.createdServerId === postId || cached?.post?.id === postId)
      localStorage.removeItem(getDraftKey())
  }
  catch { /* Ignore a corrupt cache; the post editor will load from the server. */ }
}

const store = usePostDraftStore()
const postStore = usePostStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()

const { post, isDirty } = storeToRefs(store)
const isGenerating = computed(() => postStore.isGenerating)
const isPreviewMode = ref(false)
const activeSection = ref<'about' | 'story' | 'publish'>('about')
const editorSections = [
  { id: 'about' as const, label: 'О посте', icon: 'mdi:text-box-outline' },
  { id: 'story' as const, label: 'Таймлайн', icon: 'mdi:timeline-outline' },
  { id: 'publish' as const, label: 'Публикация', icon: 'mdi:send-outline' },
]
const isAiDialogOpen = ref(false)
const isMediaTimelineOpen = ref(false)
const isManualTimeline = ref(false)
const hasTimelineContent = computed(() => (post.value.stages || []).some(stage => stage.blocks.length > 0 || stage.title !== 'Начало'))
const stageCount = computed(() => hasTimelineContent.value || isManualTimeline.value ? post.value.stages?.length || 0 : 0)
const coverMedia = computed(() => post.value.media[0])
const coverUrl = computed(() => {
  const media = coverMedia.value
  if (!media)
    return ''
  const variants = media.variants || media.metadata?.variants || {}
  return media.type === 'video' ? variants.poster || variants.small || '' : variants.medium || variants.small || media.url
})
const publishIssues = computed(() => [!post.value.title.trim() && 'Название поста', !post.value.country && 'Страна путешествия'].filter((issue): issue is string => Boolean(issue)))

function startManualTimeline() {
  isManualTimeline.value = true
  if (!post.value.stages?.length)
    store.addStage()
}
function nextSection() {
  activeSection.value = activeSection.value === 'about' ? 'story' : 'publish'
}

const isPublishing = ref(false)
const isEditMode = ref(false)
const isLoading = ref(true)

let isLeavingIntentionally = false

const aiPrompt = ref('')
const isImportingMedia = ref(false)
const mediaTimeline = ref<InstanceType<typeof MediaTimelineImport>>()
async function handleMediaTimelineSelection(media: PostMedia[]) {
  activeSection.value = 'story'
  isMediaTimelineOpen.value = true
  await nextTick()
  await mediaTimeline.value?.selectMedia(media)
}

const isMediaBusy = computed(() => isImportingMedia.value || store.activeUploads > 0)
const isDraft = computed(() => !isEditMode.value || post.value.status === 'draft')

const isMediaLibraryOpen = ref(false)
const isMapPickerOpen = ref(false)

const userSearchQuery = ref('')
const searchUserResults = ref<WhitelistUser[]>([])
const isSearchingUsers = ref(false)

const performUserSearch = useDebounceFn(() => {
  const q = userSearchQuery.value.trim()
  if (q.length < 2) {
    searchUserResults.value = []
    return
  }

  isSearchingUsers.value = true
  useRequest({
    key: 'post:search-users',
    fn: db => db.user.search(q),
    onSuccess: (data) => {
      searchUserResults.value = data || []
      isSearchingUsers.value = false
    },
    onError: () => {
      searchUserResults.value = []
      isSearchingUsers.value = false
    },
  })
}, 300)

function handleAddWhitelistUser(user: WhitelistUser) {
  store.addWhitelistUser(user)
  userSearchQuery.value = ''
  searchUserResults.value = []
}

function handleRemoveWhitelistUser(userId: string) {
  store.removeWhitelistUser(userId)
}

const durationType = ref<'hours' | 'days'>('hours')
const durationValue = ref<number | null>(null)

const tempTag = ref('')
const suggestedTags = ref<string[]>([])
const tagsWrapperRef = ref<HTMLElement | null>(null)
const isTagInputFocused = ref(false)

const stagesModel = computed({
  get: () => post.value.stages || [],
  set: val => store.reorderStages(val),
})

// Защита от случайного закрытия вкладки
onBeforeRouteLeave(async (_to, _from, next) => {
  if (isLoading.value) {
    toast.error('Дождитесь завершения загрузки редактора.')
    next(false)
    return
  }
  if (isMediaBusy.value) {
    toast.error('Дождитесь завершения загрузки медиа.')
    next(false)
    return
  }
  if (isLeavingIntentionally || isPublishing.value || !isDirty.value) {
    next()
    return
  }

  if (isDraft.value) {
    try {
      await store.savePost(store.isNewPost, 'draft')
      next()
    }
    catch {
      toast.error('Не удалось сохранить черновик. Повторите попытку перед выходом.')
      next(false)
    }
    return
  }
  const isConfirmed = await confirm({
    title: 'Закрыть редактор?',
    description: 'Текстовые правки сохранены на этом устройстве. Загруженные файлы уже привязаны к посту на сервере.',
    type: 'danger',
    confirmText: 'Покинуть',
  })

  if (isConfirmed) {
    isLeavingIntentionally = true
    next()
  }
  else {
    next(false)
  }
})

async function handleCancelBtn() {
  if (isMediaBusy.value)
    return
  const accepted = await confirm({
    title: isDraft.value ? 'Удалить черновик и все его медиа?' : 'Отменить текстовые правки?',
    description: isDraft.value ? 'Черновик и его медиатека будут удалены. Это действие необратимо.' : 'Правки текста и настроек будут отменены. Загрузки и удаления медиа уже сохранены на сервере.',
    type: 'danger',
    confirmText: isDraft.value ? 'Удалить черновик' : 'Отменить правки',
  })
  if (!accepted)
    return
  if (isDraft.value && !await store.discardDraft())
    return
  localStorage.removeItem(getDraftKey(route.params.id as string))
  isLeavingIntentionally = true
  store.isDirty = false
  await router.push(AppRoutePaths.Post.List)
}

async function handleSaveDraft() {
  if (isMediaBusy.value)
    return
  isPublishing.value = true
  try {
    await store.savePost(store.isNewPost, 'draft')
    postStore.setTab('drafts')
    isLeavingIntentionally = true
    await router.push(AppRoutePaths.Post.List)
  }
  catch {
    toast.error('Не удалось сохранить черновик.')
  }
  finally { isPublishing.value = false }
}

const calendarDateModel = computed({
  get: () => {
    if (!post.value?.startDate)
      return null
    try {
      return parseDate(post.value.startDate)
    }
    catch {
      return null
    }
  },
  set: (val) => {
    if (post.value) {
      post.value.startDate = val ? val.toString() : ''
      store.isDirty = true
    }
  },
})

const formattedStartDate = computed(() => {
  if (!post.value?.startDate)
    return ''

  const d = new Date(post.value.startDate)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
})

function openLibraryManage() {
  isMediaLibraryOpen.value = true
}

function handleMapConfirm(coords: { lat: number, lng: number }) {
  if (post.value) {
    post.value.latitude = coords.lat
    post.value.longitude = coords.lng
    store.isDirty = true
  }
}

async function fetchTags(query: string) {
  await useRequest<string[]>({
    key: EPostRequestKeys.UNIQUE_TAGS,
    fn: db => db.posts.getUniqueTags({ query }),
    onSuccess: (res) => {
      suggestedTags.value = res || []
    },
  })
}

watch(tempTag, (val) => {
  if (val && isTagInputFocused.value)
    fetchTags(val)
  else suggestedTags.value = []
})

onClickOutside(tagsWrapperRef, () => {
  isTagInputFocused.value = false
})

function addTag(val?: string) {
  const tagToAdd = (val || tempTag.value).trim().toLowerCase()
  if (tagToAdd && post.value) {
    if (post.value.tags.includes(tagToAdd))
      toast.warn(`Тег "${tagToAdd}" уже добавлен`)
    else store.addTag(tagToAdd)

    tempTag.value = ''
    suggestedTags.value = []
  }
}

watch(() => post.value?.statsDetail?.duration, (val) => {
  if (val && !durationValue.value) {
    if (val >= 24 && val % 24 === 0) {
      durationType.value = 'days'
      durationValue.value = val / 24
    }
    else {
      durationType.value = 'hours'
      durationValue.value = val
    }
  }
}, { immediate: true })

function updateDuration() {
  nextTick(() => {
    if (!post.value)
      return

    if (!durationValue.value)
      post.value.statsDetail.duration = 0
    else
      post.value.statsDetail.duration = durationType.value === 'days' ? durationValue.value * 24 : durationValue.value

    store.isDirty = true
  })
}

const countryOptions = computed(() => MOCK_COUNTRY_DATA.map(c => ({ value: c.name.rus, label: c.name.rus, flag: c.flag })))

async function handleGenerate() {
  if (!aiPrompt.value.trim() || aiPrompt.value.length < 10) {
    toast.warn('Опишите ваше путешествие подробнее (минимум 10 символов)')
    return
  }

  const isConfirmed = await confirm({
    title: 'Сгенерировать пост?',
    description: 'Внимание: все текущие заполненные поля и таймлайны будут сброшены и заменены результатом генерации ИИ. Вы уверены?',
    confirmText: 'Да, сгенерировать',
  })

  if (!isConfirmed)
    return
  const generated = await store.generateWithAi(aiPrompt.value)
  if (generated) {
    aiPrompt.value = ''
    isAiDialogOpen.value = false
    activeSection.value = 'story'
  }
}

async function handlePublish() {
  if (!post.value)
    return
  if (!post.value.title) {
    activeSection.value = 'about'
    toast.error('Пожалуйста, укажите заголовок')
    return
  }
  if (!post.value.country) {
    activeSection.value = 'about'
    toast.error('Пожалуйста, выберите страну')
    return
  }

  isPublishing.value = true
  try {
    const postId = await store.savePost(!isEditMode.value, 'completed')
    toast.success(isEditMode.value ? 'Пост обновлен!' : 'Пост успешно опубликован!')

    store.isDirty = false
    isLeavingIntentionally = true

    if (postId)
      router.push(AppRoutePaths.Post.Details(postId))
  }
  catch (e) {
    console.error(e)
    toast.error('Ошибка при сохранении поста')
  }
  finally {
    isPublishing.value = false
  }
}

const previewData = computed(() => ({
  ...post.value,
  user: { id: 'me', name: 'Автор (Вы)', avatarUrl: '' },
  stats: post.value?.stats || { likes: 0, saves: 0, isLiked: false, isSaved: false },
}))

onMounted(async () => {
  isLoading.value = true
  const id = route.params.id as string
  const draftKey = getDraftKey(id)

  if (id) {
    isEditMode.value = true
    clearNewDraftAlias(id)
    const draftStr = localStorage.getItem(draftKey)

    if (draftStr) {
      try {
        const parsed = JSON.parse(draftStr)
        store.initDraft(parsed.post, false)
        store.createdServerId = parsed.createdServerId
      }
      catch {
        const fullPost = await postStore.fetchPostById(id)
        if (fullPost) {
          store.initDraft(fullPost, false)
        }
        else {
          toast.error('Пост не найден')
          router.replace(AppRoutePaths.Post.List)
        }
      }
    }
    else {
      const fullPost = await postStore.fetchPostById(id)
      if (fullPost) {
        store.initDraft(fullPost, false)
      }
      else {
        toast.error('Пост не найден')
        router.replace(AppRoutePaths.Post.List)
      }
    }
  }
  else {
    isEditMode.value = false
    const draftStr = localStorage.getItem(draftKey)
    if (draftStr) {
      try {
        const parsed = JSON.parse(draftStr)
        store.initDraft(parsed.post, true)
        store.createdServerId = parsed.createdServerId
      }
      catch {
        store.initDraft(undefined, true)
      }
    }
    else {
      store.initDraft(undefined, true)
    }
  }
  if (!id && store.isNewPost) {
    const createdPostId = await store.ensurePostCreated()
    if (createdPostId) {
      localStorage.setItem(draftKey, JSON.stringify({
        post: store.post,
        createdServerId: createdPostId,
      }))
    }
  }
  await store.refreshMedia()
  isLoading.value = false

  store.$subscribe((_mutation, state) => {
    if (state.isDirty && !isPublishing.value) {
      localStorage.setItem(draftKey, JSON.stringify({
        post: state.post,
        createdServerId: state.createdServerId,
      }))
    }
  }, { flush: 'sync' })
})

watch(() => [post.value?.title, post.value?.insight, post.value?.description], () => {
  store.isDirty = true
}, { deep: true })
</script>

<template>
  <div class="editor-page">
    <div v-if="isPublishing" class="fullscreen-loader-overlay" role="status">
      <Icon icon="mdi:loading" class="spinner" />
      <span>Сохраняем пост…</span>
    </div>
    <div class="editor-back">
      <NavigationBack />
    </div>
    <header class="editor-topbar">
      <div class="editor-heading">
        <div>
          <h1 class="page-title">
            {{ isEditMode ? 'Редактирование поста' : 'Новый пост' }}
          </h1>
          <span class="post-status">{{ isDraft ? 'Черновик · виден только вам' : 'Опубликованный пост' }}</span>
        </div>
      </div>
      <KitBtn variant="text" :icon="isPreviewMode ? 'mdi:pencil-outline' : 'mdi:eye-outline'" :disabled="isMediaBusy" @click="isPreviewMode = !isPreviewMode">
        {{ isPreviewMode ? 'К редактору' : 'Предпросмотр' }}
      </KitBtn>
    </header>
    <div v-if="isLoading" class="loading-state">
      Загрузка редактора…
    </div>
    <div v-else-if="isPreviewMode && post" class="preview-container">
      <PostDetailsView :post="previewData" :is-preview-mode="true" />
    </div>
    <div v-else-if="post" class="editor-container">
      <nav class="editor-navigation" aria-label="Разделы редактора">
        <KitViewSwitcher v-model="activeSection" :items="editorSections" full-width />
      </nav>
      <div v-show="activeSection === 'about'" class="editor-panel">
        <div class="panel-heading">
          <h2>О чём ваше путешествие?</h2><p>Название, вступление и обложка — первое, что увидят читатели.</p>
        </div>
        <section class="meta-section">
          <div class="main-inputs">
            <KitInput v-model="post.title" label="Название поста" placeholder="Например, выходные в горах" />
            <KitInput v-model="post.description" label="Вступление" placeholder="Пара слов о путешествии…" type="textarea" :rows="3" />
          </div>
          <button class="cover-area" type="button" @click="openLibraryManage">
            <KitImage v-if="coverUrl" :src="coverUrl" object-fit="cover" class="cover-image" />
            <span v-else class="cover-placeholder"><Icon icon="mdi:image-plus-outline" /><span>{{ coverMedia ? 'Видео в медиатеке' : 'Добавить обложку' }}</span></span>
            <span class="cover-caption"><Icon icon="mdi:image-multiple-outline" />{{ post.media.length ? `Медиатека · ${post.media.length}` : 'Фото и видео' }}</span>
          </button>
        </section>
        <section class="essentials-grid">
          <div class="field-group">
            <label>Страна</label><div class="location-inputs">
              <div class="country-selector">
                <KitSelectWithSearch
                  :model-value="post.country ?? null"
                  :items="countryOptions"
                  placeholder="Страна"
                  size="sm"
                  @update:model-value="val => { if (post) { post.country = val as string; store.isDirty = true; } }"
                >
                  <template #item="{ item }">
                    <img v-if="(item as any).flag" :src="(item as any).flag" class="option-flag" alt="">
                    <span>{{ item.label }}</span>
                  </template>
                </KitSelectWithSearch>
              </div><KitBtn variant="tonal" class="map-picker-btn" icon="mdi:map-marker-outline" aria-label="Указать место на карте" @click="isMapPickerOpen = true" />
            </div>
          </div>
          <div class="field-group">
            <label>Дата начала</label>
            <KitDropdown align="start" :side-offset="4" content-class="post-date-dropdown">
              <template #trigger>
                <button type="button" class="date-trigger-wrapper" :class="{ 'is-empty': !post.startDate }" aria-label="Дата начала">
                  <Icon icon="mdi:calendar" class="input-icon-prefix" />
                  <div class="trigger-text">
                    {{ formattedStartDate || 'Выберите дату...' }}
                  </div>
                </button>
              </template>
              <div class="calendar-dropdown-content">
                <KitCalendar v-model="calendarDateModel" />
              </div>
            </KitDropdown>
          </div>
        </section>
        <details class="optional-section">
          <summary><span class="disclosure-icon"><Icon icon="mdi:tune-variant" /></span><span class="disclosure-copy"><span class="disclosure-title">Дополнительно</span><span class="summary-hint">Совет читателям, длительность и теги</span></span><Icon icon="mdi:chevron-down" /></summary>
          <div class="optional-content">
            <KitInput v-model="post.insight" label="Совет читателям" placeholder="Что стоит знать перед поездкой?" type="textarea" :rows="2" />
            <div class="field-group">
              <label>Длительность путешествия</label>
              <div class="duration-editor">
                <KitInput v-model.number="durationValue" type="number" placeholder="0" size="sm" class="duration-val-input" @input="updateDuration" />
                <KitSelectWithSearch
                  v-model="durationType"
                  :items="[{ value: 'hours', label: 'Часов' }, { value: 'days', label: 'Дней' }]"
                  size="sm"
                  class="duration-type-select"
                  :clearable="false"
                  @update:model-value="updateDuration"
                />
              </div>
            </div>
            <div class="field-group">
              <label>Теги</label>
              <div ref="tagsWrapperRef" class="tags-input-container">
                <div class="tags-input-wrapper">
                  <div v-for="tag in post.tags" :key="tag" class="tag-chip">
                    #{{ tag }} <span class="remove" @click="store.removeTag(tag)">×</span>
                  </div>
                  <input v-model="tempTag" placeholder="+ Добавить" class="tag-input" @keydown.enter="addTag()" @focus="isTagInputFocused = true; fetchTags('')">
                </div>

                <div v-if="suggestedTags.length > 0 && isTagInputFocused" class="tags-dropdown">
                  <div class="suggested-tags-wrapper">
                    <button v-for="tag in suggestedTags" :key="tag" class="suggested-tag-btn" @click.stop="addTag(tag)">
                      #{{ tag }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
      <div v-show="activeSection === 'story'" class="editor-panel">
        <div class="panel-heading">
          <h2>История по шагам</h2><p>Добавьте активности вручную или соберите их с помощью медиа и ИИ.</p>
        </div>
        <div class="timeline-tools">
          <KitBtn variant="tonal" icon="mdi:plus" @click="startManualTimeline">
            Вручную
          </KitBtn>
          <KitBtn variant="tonal" icon="mdi:image-multiple-outline" :disabled="isMediaBusy" @click="openLibraryManage">
            Из фото и видео
          </KitBtn>
          <KitBtn variant="text" icon="mdi:creation" :disabled="isMediaBusy" @click="isAiDialogOpen = true">
            Из текста с ИИ
          </KitBtn>
        </div>
        <div v-if="!hasTimelineContent && !isManualTimeline" class="timeline-empty">
          <Icon icon="mdi:timeline-outline" /><h3>Как прошло путешествие?</h3><p>Прогулка, обед, дорога — каждый момент станет отдельным этапом.</p>
        </div>
        <section v-else class="timeline-section" aria-label="Этапы путешествия">
          <draggable
            v-model="stagesModel"
            item-key="id"
            handle=".drag-handle"
            ghost-class="ghost-stage"
            class="stages-list"
            @end="store.isDirty = true"
          >
            <template #item="{ element, index }">
              <StageEditor :stage="element" :index="index" />
            </template>
          </draggable>

          <KitBtn variant="tonal" icon="mdi:plus-circle-outline" class="add-stage-btn" @click="store.addStage">
            Добавить этап
          </KitBtn>
        </section>
      </div>
      <div v-show="activeSection === 'publish'" class="editor-panel">
        <div class="panel-heading">
          <h2>Перед публикацией</h2><p>Проверьте пост и настройте доступ к приватным медиа.</p>
        </div>
        <div class="publication-summary">
          <div class="publication-identity">
            <KitImage v-if="coverUrl" :src="coverUrl" class="publication-cover" object-fit="cover" />
            <span v-else class="publication-symbol"><Icon icon="mdi:text-box-outline" /></span>
            <div class="publication-copy">
              <h3>{{ post.title || 'Пока без названия' }}</h3><p>{{ post.country || 'Страна не указана' }}<span v-if="formattedStartDate"> · {{ formattedStartDate }}</span></p><div class="post-counts">
                <span>Этапы: {{ stageCount }}</span><span>Медиа: {{ post.media.length }}</span>
              </div>
            </div>
          </div>
          <KitBtn variant="outlined" icon="mdi:eye-outline" @click="isPreviewMode = true">
            Предпросмотр
          </KitBtn>
        </div>
        <div v-if="publishIssues.length" class="publication-checklist">
          <h3>Осталось заполнить</h3>
          <KitBtn v-for="issue in publishIssues" :key="issue" variant="text" class="checklist-item" @click="activeSection = 'about'">
            <span>{{ issue }}</span><span class="checklist-action">Добавить <Icon icon="mdi:arrow-right" /></span>
          </KitBtn>
        </div>
        <details class="optional-section">
          <summary><span class="disclosure-icon"><Icon icon="mdi:shield-account-outline" /></span><span class="disclosure-copy"><span class="disclosure-title">Доступ к приватным медиа</span><span class="summary-hint">{{ post.whitelist?.length ? `Пользователей в списке: ${post.whitelist.length}` : 'Сейчас видны только вам' }}</span></span><Icon icon="mdi:chevron-down" /></summary>
          <div class="optional-content">
            <p class="field-hint">
              Добавьте тех, кому можно видеть медиа с замком. Остальные фото и видео доступны читателям поста.
            </p>
            <div class="whitelist-content">
              <div class="search-user-wrapper">
                <KitInput
                  v-model="userSearchQuery"
                  placeholder="Поиск пользователя по имени или email..."
                  @input="performUserSearch"
                />

                <div v-if="searchUserResults.length > 0" class="user-search-dropdown">
                  <div
                    v-for="foundUser in searchUserResults"
                    :key="foundUser.id"
                    class="user-search-item"
                    @click="handleAddWhitelistUser(foundUser)"
                  >
                    <KitAvatar :src="foundUser.avatarUrl || ''" :name="foundUser.name || 'Пользователь'" size="xs" />
                    <div class="user-info">
                      <div class="user-name">
                        {{ foundUser.name || 'Без имени' }}
                      </div>
                      <div v-if="foundUser.email" class="user-email">
                        {{ foundUser.email }}
                      </div>
                    </div>
                    <button class="add-user-action">
                      <Icon icon="mdi:plus" />
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="post.whitelist?.length" class="whitelist-users-grid">
                <div
                  v-for="u in post.whitelist"
                  :key="u.id"
                  class="whitelist-user-chip"
                >
                  <KitAvatar :src="u.avatarUrl || ''" :name="u.name || 'Пользователь'" size="xs" />
                  <span class="chip-name">{{ u.name || u.email || 'Пользователь' }}</span>
                  <button class="remove-chip-btn" title="Удалить из списка" @click="handleRemoveWhitelistUser(u.id)">
                    <Icon icon="mdi:close" />
                  </button>
                </div>
              </div>
              <div v-else class="whitelist-empty">
                <Icon icon="mdi:lock-outline" />
                <span>Список пуст. Приватные фото и видео будут видны только вам.</span>
              </div>
            </div>
          </div>
        </details>
        <div class="danger-action">
          <KitBtn variant="text" color="secondary" icon="mdi:trash-can-outline" :disabled="isMediaBusy" @click="handleCancelBtn">
            {{ isDraft ? 'Удалить черновик и медиа' : 'Отменить правки' }}
          </KitBtn>
        </div>
      </div>
      <footer class="editor-submit">
        <span class="footer-status">{{ isMediaBusy ? 'Обрабатываем медиа…' : isDirty ? 'Есть изменения' : 'Можно продолжить позже' }}</span>
        <div class="submit-actions">
          <KitBtn v-if="isDraft" variant="outlined" :disabled="isMediaBusy || isPublishing" @click="handleSaveDraft">
            Сохранить черновик
          </KitBtn>
          <KitBtn v-if="activeSection !== 'publish'" icon="mdi:arrow-right" :disabled="isMediaBusy" @click="nextSection">
            Далее
          </KitBtn>
          <KitBtn v-else icon="mdi:check" :disabled="isMediaBusy || isPublishing" @click="handlePublish">
            {{ isDraft ? 'Опубликовать' : 'Сохранить изменения' }}
          </KitBtn>
        </div>
      </footer>
    </div>
    <MediaLibraryPicker v-model:visible="isMediaLibraryOpen" mode="manage" allow-timeline @timeline="handleMediaTimelineSelection" @confirm="isMediaLibraryOpen = false" />
    <KitDialogWithClose v-model:visible="isMediaTimelineOpen" title="Таймлайн из медиа" :max-width="780" :persistent="isMediaBusy">
      <MediaTimelineImport ref="mediaTimeline" :disabled="isGenerating" @busy="isImportingMedia = $event" @applied="isMediaTimelineOpen = false" />
    </KitDialogWithClose>
    <KitDialogWithClose v-model:visible="isAiDialogOpen" title="Магия ИИ" :max-width="600" :persistent="isGenerating">
      <div class="ai-generation-section">
        <p class="field-hint">
          Опишите поездку. ИИ предложит название и последовательность активностей.
        </p>
        <KitInput v-model="aiPrompt" type="textarea" :rows="4" :disabled="isGenerating || isMediaBusy" placeholder="Например: Вчера мы прилетели в Париж. Утром пошли к Эйфелевой башне..." />
        <KitBtn icon="mdi:creation" variant="subtle" color="primary" :loading="isGenerating" :disabled="isMediaBusy" class="ai-btn" @click="handleGenerate">
          Сгенерировать пост
        </KitBtn>
      </div>
    </KitDialogWithClose>
    <PostMapPicker v-model:visible="isMapPickerOpen" :initial-coords="{ lat: post?.latitude ?? 0, lng: post?.longitude ?? 0 }" @confirm="handleMapConfirm" />
  </div>
</template>

<style scoped lang="scss">
.editor-page {
  --editor-width: 960px;
  min-width: 0;
  color: var(--fg-primary-color);
}
.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: var(--editor-width);
  margin: 0 auto;
  padding: 8px 0 24px;
}
.editor-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.page-title {
  margin: 0 0 4px;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.post-status,
.footer-status,
.field-hint,
.summary-hint,
.summary-label {
  font-size: 13px;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}
.editor-container {
  max-width: var(--editor-width);
  margin: 0 auto;
  min-width: 0;
}
.editor-navigation {
  position: sticky;
  top: calc(var(--header-height, 0px) + var(--safe-area-inset-top, 0px));
  z-index: 21;
  padding: 8px 0;
  margin-bottom: 24px;
  background: var(--bg-primary-color);
}
.editor-panel {
  min-height: 440px;
  min-width: 0;
  padding: 0 4px 28px;
}
.panel-heading {
  margin-bottom: 24px;
  h2 {
    margin: 0 0 6px;
    font-size: 1.3rem;
    letter-spacing: -0.025em;
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 14px;
    line-height: 1.5;
  }
}
.meta-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  align-items: stretch;
  gap: 24px;
  margin-bottom: 24px;
}
.main-inputs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.cover-area {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 180px;
  padding: 0;
  overflow: hidden;
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  &:hover,
  &:focus-visible {
    border-color: var(--fg-accent-color);
  }
}
.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  :deep(.kit-image-container),
  :deep(img) {
    height: 100%;
    width: 100%;
  }
}
.cover-placeholder {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  font-size: 14px;
  > svg {
    font-size: 28px;
  }
}
.cover-caption {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  z-index: 1;
  margin-top: auto;
  padding: 10px;
  background: var(--bg-secondary-color);
  font-size: 12px;
  width: 100%;
}
.essentials-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}
.field-group {
  min-width: 0;
  > label {
    display: block;
    font-size: 14px;
    color: var(--fg-secondary-color);
    margin-bottom: 8px;
  }
}
.location-inputs {
  display: flex;
  align-items: stretch;
  gap: 8px;
  min-width: 0;
}
.country-selector {
  flex: 1;
  min-width: 0;
}
.option-flag {
  width: 20px;
  height: 14px;
  object-fit: cover;
  margin-right: 8px;
}
.date-trigger-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  min-height: 40px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  cursor: pointer;
  .input-icon-prefix {
    color: var(--fg-secondary-color);
  }
  .trigger-text {
    font-size: 14px;
  }
}
.duration-editor {
  display: flex;
  align-items: stretch;
  gap: 8px;
  max-width: 350px;
}
.duration-val-input {
  flex: 1;
  min-width: 0;
}
.duration-type-select {
  width: 130px;
}
.editor-back {
  max-width: var(--editor-width);
  margin: 0 auto;
  padding-top: 8px;
}
.location-inputs {
  align-items: flex-start;
}
.location-inputs :deep(input),
.date-trigger-wrapper {
  height: 40px;
  min-height: 40px;
}
.location-inputs > .map-picker-btn {
  width: 40px;
  height: 40px;
  min-height: 40px;
  padding: 0;
  flex: 0 0 40px;
}
.date-trigger-wrapper {
  width: 100%;
  color: var(--fg-primary-color);
  text-align: left;
}
.optional-section {
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-primary-color);
  overflow: visible;
  > summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker {
      display: none;
    }
    > svg:last-child {
      margin-left: auto;
      flex-shrink: 0;
      color: var(--fg-secondary-color);
      transition: transform 150ms;
    }
  }
  &[open] > summary > svg:last-child {
    transform: rotate(180deg);
  }
}
.disclosure-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 18px;
}
.disclosure-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.disclosure-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}
.summary-hint {
  font-size: 12px;
  font-weight: 400;
}
.optional-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 16px 20px;
  :deep(.kit-input-wrapper input),
  :deep(.kit-input-wrapper textarea) {
    border-color: var(--border-primary-color);
    &::placeholder {
      color: var(--fg-secondary-color);
    }
  }
}
.timeline-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 24px;
}
.timeline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 250px;
  padding: 32px 20px;
  background: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  > svg {
    font-size: 36px;
    color: var(--fg-tertiary-color);
    margin-bottom: 14px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 16px;
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 14px;
    max-width: 340px;
    line-height: 1.6;
  }
}
.stages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.add-stage-btn {
  margin-top: 16px;
  width: 100%;
}
.publication-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 20px;
  margin-bottom: 20px;
  background: var(--bg-secondary-color);
  > button {
    flex-shrink: 0;
  }
}
.publication-identity {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.publication-cover,
.publication-symbol {
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  border-radius: var(--r-s);
  overflow: hidden;
}
.publication-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary-color);
  color: var(--fg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 28px;
}
.publication-copy {
  min-width: 0;
  h3 {
    font-size: 19px;
    margin: 0 0 6px;
    overflow-wrap: anywhere;
  }
  > p {
    font-size: 13px;
    margin: 0 0 10px;
    color: var(--fg-secondary-color);
  }
}
.post-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--fg-secondary-color);
}
.publication-checklist {
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  > h3 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}
.checklist-item {
  display: flex;
  width: 100%;
  padding: 10px 0;
  color: var(--fg-primary-color);
  font-weight: 500;
  border-radius: 0;
  :deep(.kit-btn-content) {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 16px;
  }
  + .checklist-item {
    border-top: 1px solid var(--border-secondary-color);
  }
}
.checklist-action {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-accent-color);
  font-size: 12px;
}
.danger-action {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  :deep(button) {
    color: var(--fg-error-color);
    font-size: 12px;
    padding: 8px;
  }
}
.editor-submit {
  position: sticky;
  bottom: calc(var(--footer-height, 0px) + var(--safe-area-inset-bottom, 0px));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  border-top: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  padding: 16px 0;
}
.submit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-left: auto;
}
.preview-container {
  max-width: var(--editor-width);
  margin: 0 auto;
}
.loading-state {
  text-align: center;
  padding: 48px;
  color: var(--fg-secondary-color);
}
.fullscreen-loader-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  background: rgba(var(--bg-primary-color-rgb), 0.95);
  .spinner {
    animation: editor-spin 1s linear infinite;
    font-size: 36px;
  }
}
.ai-generation-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@keyframes editor-spin {
  to {
    transform: rotate(360deg);
  }
}
.search-user-wrapper,
.tags-input-container {
  position: relative;
}
.user-search-dropdown,
.tags-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  box-shadow: var(--s-m);
  z-index: 30;
  max-height: 220px;
  overflow-y: auto;
}
.user-search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  cursor: pointer;
  &:hover {
    background: var(--bg-secondary-color);
  }
}
.user-info {
  flex: 1;
  min-width: 0;
  .user-name,
  .user-email {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .user-email {
    font-size: 12px;
    color: var(--fg-secondary-color);
  }
}
.add-user-action,
.remove-chip-btn {
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  display: flex;
  padding: 4px;
  cursor: pointer;
}
.whitelist-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.whitelist-users-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.whitelist-user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 24px;
  padding: 4px 8px;
  .chip-name {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
}
.whitelist-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-secondary-color);
  font-size: 13px;
}
.tags-input-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  padding: 8px;
  min-height: 40px;
}
.tag-input {
  flex: 1;
  min-width: 80px;
  border: none;
  background: transparent;
  outline: none;
  color: var(--fg-primary-color);
  font-size: 14px;
  &::placeholder {
    color: var(--fg-secondary-color);
  }
}
.tag-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 4px;
  padding: 2px 8px;
  background: var(--bg-primary-color);
  font-size: 13px;
  .remove {
    cursor: pointer;
  }
}

:global(.post-date-dropdown.kit-dropdown-content) {
  min-width: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.suggested-tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.suggested-tag-btn {
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  padding: 6px 10px;
  border-radius: var(--r-s);
  cursor: pointer;
}
@media (max-width: 640px) {
  .editor-topbar {
    gap: 8px;
    padding: 12px 0 20px;
    align-items: flex-start;
    > button {
      font-size: 12px;
      padding: 8px;
    }
  }
  .editor-heading {
    gap: 4px;
  }
  .page-title {
    font-size: 18px;
  }
  .post-status {
    font-size: 11px;
  }
  .editor-navigation {
    margin-bottom: 24px;
    :deep(.kit-view-switcher-button) {
      padding: 8px;
      gap: 5px;
      font-size: 12px;
    }
    :deep(.kit-view-switcher .kit-view-switcher-button .kit-view-switcher-label) {
      display: inline;
    }
    :deep(.kit-view-switcher-icon) {
      display: none;
    }
  }
  .meta-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .cover-area {
    min-height: 120px;
  }
  .cover-placeholder {
    flex-direction: row;
    padding: 16px;
  }
  .essentials-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .summary-hint {
    font-size: 11px;
  }
  .panel-heading h2 {
    font-size: 19px;
  }
  .editor-panel {
    min-height: 360px;
    padding-bottom: 16px;
  }
  .timeline-tools {
    gap: 8px;
    > button {
      font-size: 12px;
      padding: 10px;
    }
  }
  .footer-status {
    display: none;
  }
  .editor-submit {
    padding: 12px 0;
  }
  .submit-actions {
    flex: 1;
    gap: 8px;
    > button {
      flex: 1;
      font-size: 12px;
      padding: 10px 8px;
    }
  }
  .publication-summary {
    padding: 16px;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    > button {
      align-self: flex-start;
    }
  }
  .publication-symbol,
  .publication-cover {
    width: 56px;
    height: 56px;
    flex-basis: 56px;
  }
  .publication-copy h3 {
    font-size: 17px;
  }
  .optional-section > summary {
    padding: 14px;
    gap: 10px;
  }
  .optional-content {
    padding: 0 14px 16px;
  }
  .danger-action {
    justify-content: flex-start;
  }
}
</style>
