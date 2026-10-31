<script setup lang="ts">
import type {
  ChecklistGroup,
  ChecklistItem,
  ChecklistTab,
  ChecklistTabConfig,
} from '../models/types'
import type { ChecklistMatchResponse } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { useSpeechRecognition } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitInput } from '~/components/01.kit/kit-input'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { checklistDescription } from '../lib/location'

interface Props {
  visible: boolean
  items: ChecklistItem[]
  groups: ChecklistGroup[]
  tabs: ChecklistTabConfig[]
  readonly: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:item', value: ChecklistItem): void
  (e: 'navigateToItem', payload: { itemId: string, tabId: ChecklistTab }): void
}>()

const toast = useToast()
const { canEdit } = useTripPermissions()
// --- Голосовой ввод (Web Speech API + MediaRecorder fallback) ---
const speech = useSpeechRecognition({
  lang: 'ru-RU',
  interimResults: true,
  continuous: true,
})

const MATCH_REQUEST_KEY = 'checklist:ai-match'

const isMatching = useRequestStatus(MATCH_REQUEST_KEY)

const TRANSCRIBE_REQUEST_KEY = 'checklist:ai-transcribe'

const isTranscribing = useRequestStatus(TRANSCRIBE_REQUEST_KEY)

const uploadedFile = ref<File | null>(null)
const userQuery = ref('')
const onlyPending = ref(true)
const errorText = ref<string | null>(null)
const matchResult = ref<ChecklistMatchResponse | null>(null)
const QUICK_PROMPTS = [
  'Что из моего чек-листа можно здесь купить или попробовать?',
  'Посмотри на меню/витрину: есть ли тут что-то из моего списка?',
  'Связано ли это место с моими планами и заметками?',
]
const isMediaRecording = ref(false)
const recordingSeconds = ref(0)
let recordingTimer: ReturnType<typeof setInterval> | null = null
let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let recordedChunks: Blob[] = []
let textBeforeSpeech = ''

const isVoiceActive = computed(() => speech.isListening.value || isMediaRecording.value)
const formattedRecordingTime = computed(() => {
  const mins = Math.floor(recordingSeconds.value / 60)
  const secs = recordingSeconds.value % 60

  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
})
// --- Подготовка контекста чек-листа ---
const tabsById = computed(() => {
  const map = new Map<string, ChecklistTabConfig>()

  for (const tab of props.tabs) {
    map.set(tab.id, tab)
  }

  return map
})
const groupsById = computed(() => {
  const map = new Map<string, ChecklistGroup>()

  for (const group of props.groups) {
    map.set(group.id, group)
  }

  return map
})
const candidateItems = computed(() => {
  if (!onlyPending.value)
    return props.items

  return props.items.filter((item) => {
    if (!item.completed)
      return true

    return Boolean(item.subtasks && item.subtasks.some(s => !s.completed))
  })
})
const enrichedMatches = computed(() => {
  const matches = matchResult.value?.matches

  if (!matches)
    return []

  const itemsMap = new Map(props.items.map(i => [i.id, i]))

  return matches
    .map(m => enrichMatchEntry(m, itemsMap))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
})
const canCheckItems = computed(() => !props.readonly || canEdit.value)

watch(speech.result, (transcript) => {
  if (!speech.isListening.value)
    return

  const cleanTranscript = transcript.trim()

  if (!cleanTranscript)
    return

  userQuery.value = textBeforeSpeech
    ? `${textBeforeSpeech} ${cleanTranscript}`
    : cleanTranscript
})
watch(speech.error, (err: any) => {
  if (!err)
    return

  const errorCode = err.error || ''

  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
    toast.error('Доступ к микрофону или распознаванию речи запрещен в настройках браузера.')
  }
})
watch(speech.isListening, (listening) => {
  if (!listening && !isMediaRecording.value) {
    stopRecordingTimer()
  }
})
watch(() => props.visible, (isOpen) => {
  if (!isOpen) {
    stopVoiceRecording()
  }
})

function getItemBreadcrumbMeta(item: ChecklistItem) {
  const tab = tabsById.value.get(item.type)
  const group = item.groupId ? groupsById.value.get(item.groupId) : undefined

  return {
    tabName: tab ? tab.name : item.type,
    tabIcon: tab ? tab.icon : 'mdi:clipboard-list-outline',
    groupName: group ? group.name : null,
    groupIcon: group ? group.icon : null,
  }
}

function enrichMatchEntry(m: ChecklistMatchResponse['matches'][number], itemsMap: Map<string, ChecklistItem>) {
  const item = itemsMap.get(m.itemId)

  if (!item)
    return null

  return {
    ...m,
    item,
    ...getItemBreadcrumbMeta(item),
    matchedSubtaskSet: new Set(m.matchedSubtaskIds),
    cleanDescription: checklistDescription(item.description),
  }
}
function startRecordingTimer() {
  recordingSeconds.value = 0

  if (recordingTimer)
    clearInterval(recordingTimer)

  recordingTimer = setInterval(() => {
    recordingSeconds.value += 1
  }, 1000)
}
function stopRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}
function resolveAudioExtension(mimeType: string) {
  if (mimeType.includes('mp4'))
    return 'm4a'

  if (mimeType.includes('ogg'))
    return 'ogg'

  return 'webm'
}
function appendTranscribedText(text?: string) {
  if (!text)
    return

  const current = userQuery.value.trim()
  userQuery.value = current ? `${current} ${text}` : text
}
async function handleRecordedAudioStop(mimeType: string) {
  const audioBlob = new Blob(recordedChunks, { type: mimeType })
  cleanupMediaStream()

  if (audioBlob.size === 0)
    return

  try {
    const ext = resolveAudioExtension(mimeType)
    const audioFile = new File([audioBlob], `voice-query.${ext}`, { type: mimeType })
    const formData = new FormData()
    formData.append('file', audioFile)

    const res = await useRequest({
      key: TRANSCRIBE_REQUEST_KEY,
      fn: db => db.llm.transcribeChecklistVoice(formData),
    })

    appendTranscribedText(res?.text)
  }
  catch (e: any) {
    toast.error(e.message || 'Не удалось преобразовать голос в текст.')
  }
}
async function startMediaRecorderFallback() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast.error('Ваш браузер не поддерживает запись голоса.')

    return
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recordedChunks = []
    mediaRecorder = new MediaRecorder(mediaStream)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder?.mimeType || 'audio/webm'
      void handleRecordedAudioStop(mimeType)
    }

    mediaRecorder.start()
    isMediaRecording.value = true
    startRecordingTimer()
  }
  catch {
    toast.error('Не удалось получить доступ к микрофону.')
  }
}
function cleanupMediaStream() {
  stopRecordingTimer()
  isMediaRecording.value = false

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }

  mediaRecorder = null
}
async function toggleVoiceRecording() {
  if (isTranscribing.value)
    return

  if (isVoiceActive.value) {
    stopVoiceRecording()

    return
  }

  errorText.value = null

  if (speech.isSupported.value) {
    textBeforeSpeech = userQuery.value.trim()
    speech.start()
    startRecordingTimer()
  }
  else {
    await startMediaRecorderFallback()
  }
}
function stopVoiceRecording() {
  stopRecordingTimer()

  if (speech.isListening.value) {
    speech.stop()
  }

  if (mediaRecorder && isMediaRecording.value) {
    mediaRecorder.stop()
  }
}
function applyQuickPrompt(promptText: string) {
  userQuery.value = promptText
}
function serializeChecklistItem(item: ChecklistItem) {
  const tab = tabsById.value.get(item.type)
  const group = item.groupId ? groupsById.value.get(item.groupId) : undefined
  const desc = checklistDescription(item.description)

  return {
    id: item.id,
    text: item.text,
    completed: item.completed,
    tabName: tab?.name,
    groupName: group?.name,
    description: desc,
    cost: item.cost,
    location: item.location,
    tags: item.tags,
    subtasks: item.subtasks?.map(s => ({
      id: s.id,
      text: s.text,
      completed: s.completed,
    })),
  }
}
function buildMatchFormData() {
  const contextPayload = candidateItems.value.map(serializeChecklistItem)
  const formData = new FormData()

  if (uploadedFile.value) {
    formData.append('file', uploadedFile.value)
  }

  const trimmedQuery = userQuery.value.trim()

  if (trimmedQuery) {
    formData.append('query', trimmedQuery)
  }

  formData.append('checklistItems', JSON.stringify(contextPayload))

  return formData
}
function validateBeforeCheck(): boolean {
  if (!uploadedFile.value && !userQuery.value.trim()) {
    toast.error('Прикрепите фото или введите/надиктуйте вопрос.')

    return false
  }

  if (candidateItems.value.length === 0) {
    toast.info(onlyPending.value
      ? 'Все задачи уже выполнены! Переключите фильтр на «Все задачи», если хотите проверить весь чек-лист.'
      : 'В чек-листе пока нет задач для проверки.')

    return false
  }

  return true
}
async function handleCheckChecklist() {
  if (isVoiceActive.value) {
    stopVoiceRecording()
  }

  if (!validateBeforeCheck())
    return

  errorText.value = null

  try {
    const formData = buildMatchFormData()
    const response = await useRequest({
      key: MATCH_REQUEST_KEY,
      fn: db => db.llm.matchChecklistFromData(formData),
    })

    if (!response) {
      throw new Error('Не удалось получить ответ от ИИ.')
    }

    matchResult.value = response
  }
  catch (e: any) {
    console.error('AI checklist match error:', e)
    errorText.value = e.message || 'Произошла ошибка при проверке чек-листа.'
  }
}
function toggleMatchedItem(item: ChecklistItem, completed: boolean) {
  if (!canCheckItems.value)
    return

  emit('update:item', {
    ...item,
    completed,
  })
}
function toggleMatchedSubtask(item: ChecklistItem, subtaskId: string, completed: boolean) {
  if (!canCheckItems.value || !item.subtasks)
    return

  const updatedSubtasks = item.subtasks.map(s =>
    s.id === subtaskId ? { ...s, completed } : s)

  emit('update:item', {
    ...item,
    subtasks: updatedSubtasks,
  })
}
function handleNavigateToItem(item: ChecklistItem) {
  emit('navigateToItem', { itemId: item.id, tabId: item.type })
  emit('update:visible', false)
}
function resetToSearch() {
  matchResult.value = null
  errorText.value = null
}
function resetAll() {
  stopVoiceRecording()
  uploadedFile.value = null
  userQuery.value = ''
  matchResult.value = null
  errorText.value = null
}
function getConfidenceLabel(confidence: 'exact' | 'high' | 'possible') {
  switch (confidence) {
    case 'exact':
      return 'Точное совпадение'
    case 'high':
      return 'Высокая вероятность'
    default:
      return 'Возможно здесь'
  }
}
function getConfidenceIcon(confidence: 'exact' | 'high' | 'possible') {
  switch (confidence) {
    case 'exact':
      return 'mdi:check-decagram'
    case 'high':
      return 'mdi:thumb-up-outline'
    default:
      return 'mdi:help-circle-outline'
  }
}

onBeforeUnmount(() => {
  stopVoiceRecording()
  cleanupMediaStream()
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="AI-помощник по чек-листу"
    icon="mdi:sparkles"
    :max-width="640"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="ai-helper-modal">
      <!-- Состояние загрузки -->
      <div v-if="isMatching" class="loading-state">
        <Icon icon="svg-spinners:3-dots-fade" class="loading-spinner" />
        <p class="loading-title">
          Сверяю место и фото с вашим чек-листом...
        </p>
        <span class="loading-subtitle">
          Анализируем вывески, меню, товары и заметки ({{ candidateItems.length }} задач)
        </span>
      </div>

      <!-- Экран ввода запроса -->
      <div v-else-if="!matchResult" class="input-state">
        <p class="helper-hint">
          <Icon icon="mdi:information-outline" class="hint-icon" />
          <span>
            Сфотографируйте витрину, меню или вывеску и/или спросите голосом или текстом, есть ли здесь что-то из вашего чек-листа.
          </span>
        </p>

        <!-- Тумблер-фильтр: Невыполненные / Все задачи -->
        <div class="filter-toggle-bar">
          <span class="filter-label">
            <Icon icon="mdi:filter-variant" />
            Область проверки:
          </span>
          <div class="segmented-toggle" role="radiogroup" aria-label="Фильтр задач для проверки">
            <button
              type="button"
              class="toggle-option"
              :class="{ 'is-active': onlyPending }"
              @click="onlyPending = true"
            >
              <Icon icon="mdi:checkbox-blank-circle-outline" />
              <span>Невыполненные</span>
              <span class="count-pill">{{ items.filter(i => !i.completed || (i.subtasks && i.subtasks.some(s => !s.completed))).length }}</span>
            </button>
            <button
              type="button"
              class="toggle-option"
              :class="{ 'is-active': !onlyPending }"
              @click="onlyPending = false"
            >
              <Icon icon="mdi:format-list-bulleted" />
              <span>Весь чек-лист</span>
              <span class="count-pill">{{ items.length }}</span>
            </button>
          </div>
        </div>

        <!-- Загрузка фото -->
        <KitFileInput
          v-model="uploadedFile"
          accept=".png,.jpg,.jpeg,.webp"
        >
          <template #default>
            Нажмите, чтобы сделать фото / выбрать файл, или вставьте (Ctrl+V)
          </template>
          <template #supported-formats>
            Фото витрины, меню, вывески или товара (.jpg, .png, .webp)
          </template>
        </KitFileInput>

        <!-- Поле вопроса + Голосовой ввод -->
        <div class="query-section">
          <div class="query-header">
            <label class="query-label">Ваш вопрос или описание места</label>
            <button
              type="button"
              class="voice-btn"
              :class="{
                'is-recording': isVoiceActive,
                'is-transcribing': isTranscribing,
              }"
              :disabled="isTranscribing"
              @click="toggleVoiceRecording"
            >
              <Icon
                :icon="isTranscribing ? 'mdi:loading' : isVoiceActive ? 'mdi:stop-circle-outline' : 'mdi:microphone'"
                :class="{ spinning: isTranscribing }"
              />
              <span v-if="isTranscribing">Распознаём речь...</span>
              <span v-else-if="isVoiceActive">Запись {{ formattedRecordingTime }} • Нажмите, чтобы остановить</span>
              <span v-else>Надиктовать голосом</span>
            </button>
          </div>

          <div v-if="isVoiceActive" class="voice-active-banner">
            <span class="pulse-dot" />
            <span>Говорите — ваша речь преобразуется в текст...</span>
          </div>

          <KitInput
            v-model="userQuery"
            type="textarea"
            size="sm"
            placeholder="Например: «Я в магазине Don Quijote, что мне тут нужно купить?» или «Посмотри меню, есть ли тут блюда из моего гастро-списка?»"
            :rows="3"
          />

          <!-- Быстрые подсказки -->
          <div class="quick-prompts">
            <button
              v-for="(promptText, idx) in QUICK_PROMPTS"
              :key="idx"
              type="button"
              class="quick-prompt-chip"
              @click="applyQuickPrompt(promptText)"
            >
              {{ promptText }}
            </button>
          </div>
        </div>

        <div v-if="errorText" class="error-banner">
          <Icon icon="mdi:alert-circle-outline" />
          <span>{{ errorText }}</span>
        </div>

        <div class="modal-footer-actions">
          <KitBtn variant="text" @click="emit('update:visible', false)">
            Закрыть
          </KitBtn>
          <KitBtn
            icon="mdi:sparkles"
            :disabled="(!uploadedFile && !userQuery.trim()) || isMatching || isTranscribing"
            :loading="isMatching"
            @click="handleCheckChecklist"
          >
            Проверить по чек-листу
          </KitBtn>
        </div>
      </div>

      <!-- Экран результатов -->
      <div v-else class="results-state">
        <!-- Сводка от ИИ -->
        <div class="summary-card" :class="{ 'has-matches': enrichedMatches.length > 0 }">
          <div class="summary-header">
            <div class="summary-badge">
              <Icon :icon="enrichedMatches.length > 0 ? 'mdi:check-decagram' : 'mdi:information-outline'" />
              <span>
                {{ enrichedMatches.length > 0 ? `Найдено совпадений: ${enrichedMatches.length}` : 'Совпадений в чек-листе не найдено' }}
              </span>
            </div>
            <span v-if="matchResult.placeInfo" class="place-chip">
              <Icon icon="mdi:store-marker-outline" />
              {{ matchResult.placeInfo }}
            </span>
          </div>
          <p class="summary-text">
            {{ matchResult.summary }}
          </p>
        </div>

        <!-- Список совпавших задач -->
        <div v-if="enrichedMatches.length > 0" class="matches-list">
          <div
            v-for="entry in enrichedMatches"
            :key="entry.itemId"
            class="match-card"
            :class="[`confidence-${entry.confidence}`, { 'is-completed': entry.item.completed }]"
          >
            <div class="match-card-top">
              <div class="match-breadcrumb">
                <Icon :icon="entry.tabIcon" class="crumb-icon" />
                <span>{{ entry.tabName }}</span>
                <template v-if="entry.groupName">
                  <Icon icon="mdi:chevron-right" class="crumb-sep" />
                  <Icon v-if="entry.groupIcon" :icon="entry.groupIcon" class="crumb-icon" />
                  <span>{{ entry.groupName }}</span>
                </template>
              </div>

              <span class="confidence-badge" :class="`confidence-${entry.confidence}`">
                <Icon :icon="getConfidenceIcon(entry.confidence)" />
                {{ getConfidenceLabel(entry.confidence) }}
              </span>
            </div>

            <div class="match-main-row">
              <KitCheckbox
                :model-value="entry.item.completed"
                color="accent"
                :readonly="!canCheckItems"
                @update:model-value="toggleMatchedItem(entry.item, !!$event)"
              />
              <div class="match-item-info">
                <div class="match-item-title" :class="{ completed: entry.item.completed }">
                  {{ entry.item.text }}
                </div>
                <div v-if="entry.item.cost || entry.item.location" class="match-item-meta">
                  <span v-if="entry.item.cost" class="meta-pill cost-pill">
                    <Icon icon="mdi:cash" />
                    {{ entry.item.cost }}
                  </span>
                  <span v-if="entry.item.location" class="meta-pill location-pill">
                    <Icon icon="mdi:map-marker-outline" />
                    {{ entry.item.location }}
                  </span>
                </div>
              </div>

              <button
                type="button"
                class="goto-item-btn"
                title="Показать задачу в чек-листе"
                @click="handleNavigateToItem(entry.item)"
              >
                <Icon icon="mdi:arrow-top-right" />
                <span>К задаче</span>
              </button>
            </div>

            <!-- Пояснение от ИИ -->
            <div v-if="entry.reason" class="match-reason">
              <Icon icon="mdi:sparkles" class="reason-icon" />
              <span>{{ entry.reason }}</span>
            </div>

            <!-- Описание из заметки, если есть -->
            <div v-if="entry.cleanDescription" class="match-item-description">
              {{ entry.cleanDescription }}
            </div>

            <!-- Подзадачи (subtasks), если есть -->
            <div v-if="entry.item.subtasks && entry.item.subtasks.length > 0" class="match-subtasks">
              <div
                v-for="sub in entry.item.subtasks"
                :key="sub.id"
                class="match-subtask-row"
                :class="{
                  'is-highlighted': entry.matchedSubtaskSet.has(sub.id),
                  'is-completed': sub.completed,
                }"
              >
                <KitCheckbox
                  :model-value="sub.completed"
                  color="accent"
                  :readonly="!canCheckItems"
                  @update:model-value="toggleMatchedSubtask(entry.item, sub.id, !!$event)"
                />
                <span class="subtask-label">{{ sub.text }}</span>
                <span v-if="entry.matchedSubtaskSet.has(sub.id)" class="subtask-match-tag">
                  Есть здесь
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer-actions">
          <KitBtn variant="text" icon="mdi:arrow-left" @click="resetToSearch">
            Изменить запрос
          </KitBtn>
          <KitBtn variant="tonal" icon="mdi:refresh" @click="resetAll">
            Новая проверка
          </KitBtn>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.ai-helper-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 240px;
  padding: 2rem 1rem;
  gap: 0.75rem;
  color: var(--fg-secondary-color);

  .loading-spinner {
    font-size: 3rem;
    color: var(--fg-accent-color);
  }

  .loading-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .loading-subtitle {
    font-size: 0.85rem;
    color: var(--fg-tertiary-color);
  }
}

.input-state,
.results-state {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.helper-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--fg-secondary-color);
  background: var(--bg-secondary-color);
  padding: 0.65rem 0.85rem;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);

  .hint-icon {
    font-size: 1.15rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    margin-top: 1px;
  }
}

.filter-toggle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.segmented-toggle {
  display: inline-flex;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 2px;
  gap: 2px;
}

.toggle-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: calc(var(--r-s) - 2px);
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--fg-primary-color);
  }

  &.is-active {
    background: var(--bg-primary-color);
    color: var(--fg-accent-color);
    box-shadow: var(--s-xs);
    font-weight: 600;
  }
}

.count-pill {
  font-size: 0.72rem;
  padding: 1px 5px;
  border-radius: var(--r-full);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
}

.query-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.query-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.query-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.voice-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: var(--r-full);
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }

  &.is-recording {
    background: var(--bg-error-color);
    border-color: var(--fg-error-color);
    color: var(--fg-error-color);
  }

  &.is-transcribing {
    opacity: 0.75;
    cursor: wait;
  }
}

.voice-active-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  border-radius: var(--r-s);
  background: var(--bg-secondary-color);
  border: 1px dashed var(--fg-error-color);
  color: var(--fg-primary-color);
  font-size: 0.8rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fg-error-color);
  animation: pulse-recording 1.2s infinite ease-in-out;
}

@keyframes pulse-recording {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.45;
  }
}

.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.quick-prompt-chip {
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-primary-color);
    background: var(--bg-hover-color);
  }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--r-s);
  background: var(--bg-error-color);
  color: var(--fg-error-color);
  font-size: 0.875rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  &.has-matches {
    border-color: var(--fg-accent-color);
  }
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.summary-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--fg-accent-color);
}

.place-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: var(--r-full);
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
}

.summary-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--fg-primary-color);
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 3px solid var(--fg-accent-color);
  transition: all 0.2s ease;

  &.confidence-exact {
    border-left-color: var(--fg-success-color);
  }

  &.confidence-high {
    border-left-color: var(--fg-accent-color);
  }

  &.confidence-possible {
    border-left-color: var(--fg-warning-color);
  }

  &.is-completed {
    opacity: 0.78;
  }
}

.match-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.match-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  font-weight: 500;

  .crumb-icon {
    font-size: 0.85rem;
  }

  .crumb-sep {
    font-size: 0.85rem;
  }
}

.confidence-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);

  &.confidence-exact {
    color: var(--fg-success-color);
  }

  &.confidence-high {
    color: var(--fg-accent-color);
  }

  &.confidence-possible {
    color: var(--fg-warning-color);
  }
}

.match-main-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.match-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-grow: 1;
  min-width: 0;
}

.match-item-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.35;

  &.completed {
    text-decoration: line-through;
    color: var(--fg-tertiary-color);
  }
}

.match-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);

  &.cost-pill {
    color: var(--fg-accent-color);
  }
}

.goto-item-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.55rem;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.match-reason {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.83rem;
  line-height: 1.4;
  color: var(--fg-primary-color);
  background: var(--bg-primary-color);
  padding: 0.5rem 0.65rem;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);

  .reason-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.match-item-description {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
  padding-left: 0.25rem;
}

.match-subtasks {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--border-secondary-color);
}

.match-subtask-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.45rem;
  border-radius: var(--r-xs);
  font-size: 0.82rem;
  color: var(--fg-secondary-color);

  &.is-highlighted {
    background: var(--bg-primary-color);
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  &.is-completed .subtask-label {
    text-decoration: line-through;
    color: var(--fg-tertiary-color);
  }
}

.subtask-label {
  flex-grow: 1;
}

.subtask-match-tag {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  background: var(--bg-tertiary-color);
  padding: 1px 6px;
  border-radius: var(--r-full);
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-secondary-color);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@include media-down(sm) {
  .filter-toggle-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .segmented-toggle {
    width: 100%;

    .toggle-option {
      flex: 1;
      justify-content: center;
    }
  }
}
</style>
