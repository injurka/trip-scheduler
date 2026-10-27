<script setup lang="ts">
import type { MediaGroup, TimelineMedia } from '../../../lib/media-timeline'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { PostMedia, TimelineStage } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { v4 as uuid } from 'uuid'
import { computed, ref } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitImageViewer } from '~/components/01.kit/kit-image-viewer'
import { KitInput } from '~/components/01.kit/kit-input'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { createAnalysisFrame, groupTimelineMedia, prepareGroupAnalysisFrame, readStoredTimelineMedia } from '../../../lib/media-timeline'
import { usePostDraftStore } from '../../../store/post-draft.store'
import MediaLibraryPicker from './media-library-picker.vue'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean], applied: [] }>()
const store = usePostDraftStore()
const toast = useToast()
const items = ref<TimelineMedia[]>([])
const groups = ref<MediaGroup[]>([])
const gap = ref<string | number | null>(60)
const appliedGap = ref<number | null>(null)
const generatedGroupState = ref('')
const busy = ref(false)
const progress = ref('')
const error = ref('')
const libraryOpen = ref(false)
const groupPreviewOpen = ref(false)
const groupPreviewImages = ref<ImageViewerImage[]>([])
const groupPreviewIndex = ref(0)
const selectedMediaIds = computed(() => items.value.flatMap(item => item.media ? [item.media.id] : []))
const unknownCount = computed(() => items.value.filter(item => !item.capturedAt).length)
const hasGapChanges = computed(() => appliedGap.value !== normalizeGap(gap.value))
const currentGroupState = computed(() => JSON.stringify(groups.value.map(group => ({
  ids: group.items.map(item => item.media?.id ?? item.file?.name ?? item.capturedAt),
  title: group.title,
  date: group.date,
  time: group.time,
}))))
const hasGroupChanges = computed(() => generatedGroupState.value !== currentGroupState.value)
const canRegroup = computed(() => hasGapChanges.value || hasGroupChanges.value)

function normalizeGap(value: string | number | null): number {
  return Math.max(5, Math.min(240, Number(value) || 60))
}

function getGroupThumbnail(item: TimelineMedia): string {
  const media = item.media
  if (!media)
    return ''
  return media.variants?.poster || media.metadata?.variants?.poster
    || media.variants?.small || media.metadata?.variants?.small || media.url
}

function toGroupPreviewImage(media: PostMedia): ImageViewerImage {
  const variants = {
    ...(media.metadata?.variants || {}),
    ...(media.variants || {}),
  }

  return {
    url: media.type === 'video' ? variants.web || media.url : media.url,
    alt: media.originalName || 'Медиафайл',
    caption: media.originalName || undefined,
    mediaType: media.type,
    variants,
    meta: {
      ...(media.metadata || {}),
      mediaId: media.id,
      mediaType: media.type,
      width: media.width ?? media.metadata?.width,
      height: media.height ?? media.metadata?.height,
    },
  }
}

function openGroupPreview(group: MediaGroup, selectedItem?: TimelineMedia) {
  if (!selectedItem?.media)
    return

  const media = group.items.flatMap(item => item.media ? [item.media] : [])
  const currentIndex = media.findIndex(item => item.id === selectedItem.media?.id)
  if (currentIndex < 0)
    return

  groupPreviewImages.value = media.map(toGroupPreviewImage)
  groupPreviewIndex.value = currentIndex
  groupPreviewOpen.value = true
}

function setBusy(value: boolean) {
  busy.value = value
  emit('busy', value)
}
function regroup() {
  const normalizedGap = normalizeGap(gap.value)
  gap.value = normalizedGap
  appliedGap.value = normalizedGap
  groups.value = groupTimelineMedia(items.value, normalizedGap)
  generatedGroupState.value = currentGroupState.value
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
    const failedGroups: number[] = []
    for (const [id, group] of groups.value.entries()) {
      progress.value = `Готовим кадры для ИИ: ${id + 1} / ${groups.value.length}`
      if (!group.items.some(item => item.media?.type === 'image'))
        continue
      const frame = await prepareGroupAnalysisFrame(group, async (path) => {
        const blob = await useRequest({ key: 'post:media-frame', fn: db => db.files.downloadMediaPreview(path), onError: () => {} })
        return blob ? createAnalysisFrame(blob) : undefined
      })
      if (frame)
        samples.push({ id, count: group.items.filter(item => item.media?.type === 'image').length, frame })
      else
        failedGroups.push(id + 1)
    }
    if (failedGroups.length) {
      error.value = `Не удалось подготовить кадры для групп: ${failedGroups.join(', ')}. Проверьте доступность медиа и повторите анализ. Группы сохранены.`
      return
    }
    if (!samples.length) {
      toast.info('В выбранных группах нет фото для анализа ИИ.')
      return
    }
    const titles: { id: number, title: string }[] = []
    for (let offset = 0; offset < samples.length; offset += 12) {
      progress.value = `ИИ подбирает названия активностей: ${offset + 1}–${Math.min(offset + 12, samples.length)} / ${samples.length}…`
      const data = await useRequest({
        key: 'post:media-timeline:describe',
        fn: db => db.posts.describeMediaTimeline({ groups: samples.slice(offset, offset + 12) }),
        onError: () => { error.value = 'Не удалось получить полный набор названий от ИИ. Группы сохранены, повторите анализ или измените названия вручную.' },
      })
      if (!data)
        return
      titles.push(...data.groups)
    }
    const expectedIds = new Set(samples.map(sample => sample.id))
    if (titles.length !== samples.length || new Set(titles.map(result => result.id)).size !== expectedIds.size
      || titles.some(result => !expectedIds.has(result.id))) {
      error.value = 'ИИ вернул неполный набор названий. Группы сохранены, повторите анализ.'
      return
    }
    titles.forEach((result) => {
      groups.value[result.id].title = result.title
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
      title: '',
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
        title: group.title.trim(),
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
    <div v-if="!groups.length" class="media-selection-empty">
      <div class="selection-empty-copy">
        <span class="selection-empty-icon"><Icon icon="mdi:image-multiple-outline" /></span>
        <div>
          <strong>Соберите таймлайн из медиа</strong>
          <p>Выберите фото и видео — мы сгруппируем их по времени и месту съёмки.</p>
        </div>
      </div>
      <KitBtn icon="mdi:plus" :disabled="busy || disabled" @click="libraryOpen = true">
        Выбрать медиа
      </KitBtn>
    </div>
    <div v-else class="selection-summary">
      <div class="selection-summary-copy">
        <span class="selection-summary-icon"><Icon icon="mdi:check-circle" /></span>
        <div>
          <strong>Выбрано медиа: {{ items.length }}</strong>
          <span>Создано групп: {{ groups.length }}</span>
        </div>
      </div>
      <KitBtn variant="outlined" color="secondary" size="sm" icon="mdi:image-multiple-outline" :disabled="busy || disabled" @click="libraryOpen = true">
        Изменить выбор
      </KitBtn>
    </div>

    <p v-if="busy" role="status" aria-live="polite">
      {{ progress }}
    </p>
    <p v-if="error" role="alert">
      {{ error }}
    </p>
    <template v-if="groups.length">
      <section class="grouping-panel" aria-label="Настройки автоматической группировки">
        <div class="grouping-panel-heading">
          <div>
            <h3>Автоматическая группировка</h3>
            <p>Разделяем по времени съёмки и месту.</p>
          </div>
          <span class="group-count">Групп: {{ groups.length }}</span>
        </div>
        <div class="grouping-controls">
          <KitInput v-model="gap" label="Пауза между активностями, минут" type="number" min="5" max="240" :disabled="busy" />
          <KitBtn variant="outlined" color="secondary" size="md" icon="mdi:refresh" :disabled="busy || !canRegroup" @click="regroup">
            Пересчитать группы
          </KitBtn>
        </div>
        <p class="grouping-hint">
          Если между соседними файлами прошло больше указанного времени, начнётся новая группа.
        </p>
        <p v-if="canRegroup" class="grouping-warning">
          Пересчёт заменит текущие группы, названия и ручное разделение.
        </p>
      </section>

      <div v-if="unknownCount" class="import-alert">
        <Icon icon="mdi:calendar-question-outline" />
        <p>
          Файлы без даты съёмки ({{ unknownCount }}) собраны отдельно. Укажите им дату и время вручную; дата изменения файла не используется.
        </p>
      </div>
      <p class="import-note">
        <Icon icon="mdi:clock-outline" />
        Даты видео показаны по часовому поясу устройства. Если снимали в другом поясе, проверьте время.
      </p>

      <details class="ai-options">
        <summary>
          <Icon icon="mdi:creation" class="ai-icon" />
          <span class="ai-summary-copy">
            <strong>Подобрать названия с ИИ</strong>
            <small>Необязательно · расходует ИИ-кредиты</small>
          </span>
          <Icon icon="mdi:chevron-down" class="ai-chevron" />
        </summary>
        <div class="ai-options-content">
          <p>ИИ анализирует по одному кадру до 384 px из каждой группы: максимум 12 групп и 900 выходных токенов за запуск. Остальные названия можно задать вручную.</p>
          <KitBtn icon="mdi:creation" variant="outlined" color="secondary" size="sm" :disabled="busy" @click="analyze">
            Подобрать названия
          </KitBtn>
        </div>
      </details>

      <ol class="group-preview" aria-label="Проверьте активности перед добавлением">
        <li v-for="(group, index) in groups" :key="index" class="group-card">
          <div class="group-card-heading">
            <strong>Активность {{ index + 1 }}</strong>
            <span>Файлов: {{ group.items.length }}</span>
          </div>
          <KitInput v-model="group.title" label="Название (необязательно)" :disabled="busy" />
          <div class="group-media-preview">
            <div class="thumbnail-strip">
              <button
                v-for="(item, previewIndex) in group.items.slice(0, 4)"
                :key="item.media?.id ?? previewIndex"
                type="button"
                class="timeline-thumbnail"
                :aria-label="`Просмотреть ${item.media?.originalName || 'медиафайл'}`"
                @click="openGroupPreview(group, item)"
              >
                <KitImage v-if="getGroupThumbnail(item)" :src="getGroupThumbnail(item)" alt="" object-fit="cover" />
                <Icon v-if="item.media?.type === 'video'" icon="mdi:play-circle" class="thumbnail-video-icon" />
              </button>
              <button
                v-if="group.items.length > 4"
                type="button"
                class="thumbnail-more"
                :aria-label="`Просмотреть ещё ${group.items.length - 4} файлов`"
                @click="openGroupPreview(group, group.items[4])"
              >
                +{{ group.items.length - 4 }}
              </button>
            </div>
          </div>
          <div class="group-datetime">
            <KitInput v-model="group.date" label="Дата" type="date" :disabled="busy" />
            <KitInput v-model="group.time" label="Время" type="time" :disabled="busy" />
          </div>
          <div class="group-card-actions">
            <KitBtn v-if="group.items.length > 1" variant="text" color="secondary" size="sm" icon="mdi:content-cut" :disabled="busy" @click="splitGroup(index)">
              Разделить группу пополам
            </KitBtn>
            <KitBtn v-if="groups[index + 1] && groups[index + 1].date === group.date" variant="text" color="secondary" size="sm" icon="mdi:merge" :disabled="busy" @click="mergeGroup(index)">
              Объединить со следующей
            </KitBtn>
          </div>
        </li>
      </ol>

      <KitBtn class="timeline-submit" icon="mdi:timeline-outline" :loading="busy" :disabled="busy || disabled" @click="apply">
        Добавить в таймлайн ({{ groups.length }})
      </KitBtn>
    </template>
    <MediaLibraryPicker v-model:visible="libraryOpen" :selected-ids="selectedMediaIds" mode="select" title="Медиа для таймлайна" @confirm="selectMedia" @busy="setBusy" />
    <KitImageViewer
      :visible="groupPreviewOpen"
      :images="groupPreviewImages"
      :current-index="groupPreviewIndex"
      :enable-thumbnails="true"
      :show-info-button="false"
      @update:visible="groupPreviewOpen = $event"
      @update:current-index="groupPreviewIndex = $event"
      @close="groupPreviewOpen = false"
    />
  </div>
</template>

<style scoped lang="scss">
.media-timeline-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  min-width: 0;

  > p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }
}
.media-selection-empty,
.selection-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
}
.selection-empty-copy,
.selection-summary-copy {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.selection-summary-copy {
  flex: 1 1 auto;
}
.selection-empty-icon,
.selection-summary-icon {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-primary-color);
  color: var(--fg-accent-color);
  font-size: 20px;
}
.selection-summary-icon {
  border: 0;
  background: transparent;
  font-size: 24px;

  :deep(svg) {
    display: block;
    width: 24px;
    height: 24px;
  }
}
.selection-empty-copy strong,
.selection-summary-copy strong {
  display: block;
  color: var(--fg-primary-color);
  font-size: 14px;
}
.selection-empty-copy p,
.selection-summary-copy > div > span {
  display: block;
  margin: 4px 0 0;
  color: var(--fg-secondary-color);
  font-size: 12px;
  line-height: 1.4;
}
.selection-empty-copy .selection-empty-icon + div {
  min-width: 0;
}
.media-selection-empty > button,
.selection-summary > button {
  flex: 0 0 auto;
}
.grouping-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
}
.grouping-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h3 {
    margin: 0;
    color: var(--fg-primary-color);
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 4px 0 0;
    color: var(--fg-secondary-color);
    font-size: 12px;
  }
}
.group-count {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: var(--r-full);
  background: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 12px;
}
.grouping-controls {
  display: grid;
  grid-template-columns: minmax(160px, 220px) auto;
  align-items: end;
  gap: 12px;
}
.grouping-hint,
.grouping-warning {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 12px;
  line-height: 1.45;
}
.grouping-warning {
  padding-top: 10px;
  border-top: 1px solid var(--border-secondary-color);
}
.import-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border-warning-color, var(--border-secondary-color));
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);

  > svg {
    flex: 0 0 auto;
    margin-top: 2px;
    color: var(--fg-warning-color);
    font-size: 18px;
  }

  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
  }
}
.import-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: -4px 0 0 !important;
  color: var(--fg-secondary-color);
  font-size: 12px !important;

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
    font-size: 16px;
  }
}
.ai-options {
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-primary-color);

  summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &[open] .ai-chevron {
    transform: rotate(180deg);
  }
}
.ai-icon {
  flex: 0 0 auto;
  color: var(--fg-accent-color);
  font-size: 18px;
}
.ai-summary-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: var(--fg-primary-color);
    font-size: 13px;
  }

  small {
    color: var(--fg-secondary-color);
    font-size: 11px;
  }
}
.ai-chevron {
  flex: 0 0 auto;
  color: var(--fg-secondary-color);
  transition: transform 0.2s ease;
}
.ai-options-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px 14px;

  p {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 12px;
    line-height: 1.45;
  }
}
.group-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.group-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-primary-color);
}
.group-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    color: var(--fg-primary-color);
    font-size: 14px;
  }

  span {
    flex: 0 0 auto;
    color: var(--fg-secondary-color);
    font-size: 12px;
  }
}
.group-media-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.thumbnail-strip {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
}
.timeline-thumbnail {
  position: relative;
  display: block;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  padding: 0;
  border: 0;
  overflow: hidden;
  border-radius: var(--r-xs);
  background: var(--bg-tertiary-color);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

  :deep(.kit-image-wrapper) {
    width: 100%;
    height: 100%;
  }
}
.thumbnail-video-icon {
  position: absolute;
  right: 3px;
  bottom: 3px;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
  font-size: 16px;
}
.thumbnail-more {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  padding: 0;
  border: 0;
  border-radius: var(--r-xs);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }
}

.group-datetime {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.group-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding-top: 4px;
  border-top: 1px solid var(--border-secondary-color);
}
.timeline-submit {
  position: sticky;
  bottom: 0;
  z-index: 2;
  width: 100%;
  margin-top: 4px;
}
@media (max-width: 640px) {
  .media-selection-empty,
  .selection-summary {
    align-items: stretch;
    flex-direction: column;
  }
  .media-selection-empty > button,
  .selection-summary > button {
    align-self: flex-start;
  }
  .grouping-controls {
    grid-template-columns: minmax(0, 1fr);
  }
  .grouping-controls > button {
    justify-self: end;
  }
  .ai-options-content {
    align-items: flex-start;
    flex-direction: column;
  }
  .group-datetime {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
