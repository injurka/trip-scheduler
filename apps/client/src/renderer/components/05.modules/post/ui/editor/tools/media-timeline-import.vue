<script setup lang="ts">
import type { MediaGroup, TimelineMedia } from '../../../lib/media-timeline'
import type { PostMedia, TimelineStage } from '~/shared/types/models/post'
import { v4 as uuid } from 'uuid'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitInput } from '~/components/01.kit/kit-input'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { createAnalysisFrame, groupTimelineMedia, readStoredTimelineMedia } from '../../../lib/media-timeline'
import { usePostDraftStore } from '../../../store/post-draft.store'
import MediaLibraryPicker from './media-library-picker.vue'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean], applied: [] }>()
const store = usePostDraftStore()
const toast = useToast()
const items = ref<TimelineMedia[]>([])
const groups = ref<MediaGroup[]>([])
const gap = ref<string | number | null>(60)
const useAi = ref(false)
const busy = ref(false)
const progress = ref('')
const error = ref('')
const libraryOpen = ref(false)
const unknownCount = computed(() => items.value.filter(item => !item.capturedAt).length)

function setBusy(value: boolean) {
  busy.value = value
  emit('busy', value)
}
function regroup() {
  gap.value = Math.max(5, Math.min(240, Number(gap.value) || 60))
  groups.value = groupTimelineMedia(items.value, Number(gap.value))
}
async function selectMedia(media: PostMedia[]) {
  if (busy.value || props.disabled)
    return
  if (media.length > 500) {
    toast.error('Выберите не больше 500 файлов за один раз.')
    return
  }
  items.value = media.map(readStoredTimelineMedia)
  error.value = ''
  regroup()
}
defineExpose({ selectMedia })

async function analyze() {
  setBusy(true)
  error.value = ''
  try {
    const samples: { id: number, count: number, frame: string }[] = []
    for (const [id, group] of groups.value.slice(0, 12).entries()) {
      progress.value = `Готовим кадры для ИИ: ${id + 1} / ${Math.min(groups.value.length, 12)}`
      const media = group.items[Math.floor(group.items.length / 2)].media
      if (!media)
        continue
      const preview = media.variants?.poster || media.metadata?.variants?.poster
        || media.variants?.small || media.metadata?.variants?.small || (media.type === 'image' ? media.url : undefined)
      if (!preview)
        continue
      const blob = await useRequest({ key: `post:media-frame:${media.id}`, fn: db => db.files.downloadMediaPreview(preview), onError: () => {} })
      const frame = blob ? await createAnalysisFrame(blob) : undefined
      if (frame)
        samples.push({ id, count: group.items.length, frame })
    }
    if (!samples.length) {
      error.value = 'Не удалось получить кадры. Можно создать таймлайн без ИИ.'
      return
    }
    progress.value = 'ИИ подбирает названия активностей…'
    await useRequest({
      key: 'post:media-timeline:describe',
      fn: db => db.posts.describeMediaTimeline({ groups: samples }),
      onSuccess: (data) => {
        data?.groups.forEach((result) => {
          if (groups.value[result.id])
            groups.value[result.id].title = result.title
        })
      },
      onError: () => { error.value = 'ИИ недоступен. Группы сохранены, названия можно изменить вручную.' },
    })
  }
  catch {
    error.value = 'Не удалось подготовить анализ. Можно создать таймлайн без ИИ.'
  }
  finally { setBusy(false) }
}

function splitGroup(index: number) {
  const group = groups.value[index]
  const tail = group.items.splice(Math.ceil(group.items.length / 2))
  if (tail.length) {
    groups.value.splice(index + 1, 0, {
      items: tail,
      title: 'Новая активность',
      date: tail[0].capturedAt.slice(0, 10) || group.date,
      time: tail[0].capturedAt.slice(11, 16) || group.time,
    })
  }
}
function mergeGroup(index: number) {
  groups.value[index].items.push(...groups.value[index + 1].items)
  groups.value.splice(index + 1, 1)
}
function calendarDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86400000
}
async function apply() {
  if (!groups.value.length || busy.value)
    return
  setBusy(true)
  error.value = ''
  try {
    const stages: TimelineStage[] = []
    const dates = groups.value.map(group => group.date).filter(Boolean).sort()
    const oldStart = store.post.startDate?.slice(0, 10)
    const start = [oldStart, dates[0]].filter((date): date is string => Boolean(date)).sort()[0]
    const orderedGroups = [...groups.value].sort((a, b) => `${a.date || '9999'}T${a.time}`.localeCompare(`${b.date || '9999'}T${b.time}`))
    for (const group of orderedGroups) {
      const media = group.items.flatMap(item => item.media ? store.post.media.filter(current => current.id === item.media?.id) : [])
      if (media.length !== group.items.length)
        throw new Error('Часть выбранных медиа удалена. Выберите файлы из медиатеки заново.')
      stages.push({
        id: uuid(),
        title: group.title.trim() || 'Активность',
        day: group.date && start ? Math.max(1, Math.round(calendarDay(group.date) - calendarDay(start)) + 1) : 1,
        time: group.time || '',
        order: stages.length,
        blocks: [{ id: uuid(), type: 'gallery', images: media, displayType: 'grid' }],
      })
    }
    const existing = store.post.stages || []
    // Drop only the untouched initial placeholder, retaining any authored content.
    const keep = existing.length === 1 && !existing[0].blocks.length && existing[0].title === 'Начало' ? [] : existing
    if (oldStart && start && oldStart > start) {
      const shift = Math.round(calendarDay(oldStart) - calendarDay(start))
      keep.forEach((stage) => {
        stage.day = (stage.day || 1) + shift
      })
    }
    store.post.stages = [...keep, ...stages].map((stage, order) => ({ ...stage, order }))
    if (start)
      store.post.startDate = start
    store.isDirty = true
    items.value = []
    groups.value = []
    emit('applied')
    toast.success('Активности добавлены в таймлайн. Проверьте названия и время перед публикацией.')
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось создать таймлайн.'
  }
  finally { setBusy(false) }
}
</script>

<template>
  <div class="media-timeline-import">
    <KitBtn icon="mdi:image-multiple-outline" variant="tonal" :disabled="busy || disabled" @click="libraryOpen = true">
      Выбрать медиа
    </KitBtn>
    <p v-if="!groups.length">
      Выберите фото и видео. Сгруппируем их по времени съёмки и месту.
    </p>
    <p v-if="busy" role="status" aria-live="polite">
      {{ progress }}
    </p>
    <p v-if="error" role="alert">
      {{ error }}
    </p>
    <template v-if="groups.length">
      <div class="import-controls">
        <KitInput v-model="gap" label="Пауза между активностями, минут (5–240)" type="number" :disabled="busy" />
        <KitBtn variant="text" :disabled="busy" @click="regroup">
          Перегруппировать
        </KitBtn>
      </div>
      <p v-if="unknownCount">
        У {{ unknownCount }} файлов нет даты съёмки. Они в отдельной группе — укажите дату и время вручную. Дата изменения файла не используется.
      </p>
      <p>Даты видео показаны в часовом поясе устройства. Проверьте время, если снимали в другом поясе.</p>
      <KitCheckbox v-model="useAi" :disabled="busy">
        Подобрать тематические названия с ИИ
      </KitCheckbox>
      <template v-if="useAi">
        <p>Один кадр на группу, максимум 12 кадров по 384 px и 900 выходных токенов за запуск. Анализ расходует ИИ-кредиты. Остальные названия можно заполнить вручную.</p>
        <KitBtn icon="mdi:creation" variant="tonal" :disabled="busy" @click="analyze">
          Подобрать названия
        </KitBtn>
      </template>
      <ol class="group-preview">
        <li v-for="(group, index) in groups" :key="index">
          <KitInput v-model="group.title" label="Активность" :disabled="busy" />
          <div class="import-controls">
            <KitInput v-model="group.date" label="Дата" type="date" :disabled="busy" />
            <KitInput v-model="group.time" label="Время" type="time" :disabled="busy" />
          </div>
          <span>{{ group.items.length }} файлов · {{ group.items[0].media?.originalName }}</span>
          <div class="import-controls">
            <KitBtn v-if="group.items.length > 1" variant="text" :disabled="busy" @click="splitGroup(index)">
              Разделить пополам
            </KitBtn>
            <KitBtn v-if="groups[index + 1] && groups[index + 1].date === group.date" variant="text" :disabled="busy" @click="mergeGroup(index)">
              Объединить со следующей
            </KitBtn>
          </div>
        </li>
      </ol>
      <KitBtn icon="mdi:timeline-outline" :loading="busy" :disabled="busy" @click="apply">
        Добавить активности ({{ groups.length }})
      </KitBtn>
    </template>
    <MediaLibraryPicker v-model:visible="libraryOpen" mode="select" title="Медиа для таймлайна" @confirm="selectMedia" @busy="setBusy" />
  </div>
</template>

<style scoped lang="scss">
.media-timeline-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }
}
.import-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
}
.group-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 480px;
  overflow: auto;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
  }
  span {
    overflow-wrap: anywhere;
    font-size: 13px;
  }
}
</style>
