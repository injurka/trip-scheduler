<script setup lang="ts">
import type { Time } from '@internationalized/date'
import type { Memory, MemoryProposal } from '~/shared/types/models/memory'
import { Icon } from '@iconify/vue'
import { parseTime } from '@internationalized/date'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { useRequest } from '~/plugins/request'
import { useVoiceRecorder } from '../../composables/use-voice-recorder'

interface Props {
  visible: boolean
  dayId: string
  existing: Memory[]
  tripTitle?: string
  dayTitle?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'saved': [memories: Memory[]]
}>()

const voiceRecorder = useVoiceRecorder()

const text = ref('')
const blocks = ref<MemoryProposal['blocks']>([])
const busy = ref(false)
const transcribing = ref(false)
const error = ref('')
const preview = ref(false)
const isVoicePanelOpen = ref(false)
const hasRestoredDraft = ref(false)
const transcriptionNotice = ref('')
const isAudioPlaying = ref(false)
const audioElementRef = ref<HTMLAudioElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const DRAFT_KEY_PREFIX = 'ts_memory_story_draft_'
const blockTypeLabels = {
  activity: 'Активность',
  note: 'Заметка',
}
const tagOptions = [
  { value: 'walk', label: 'Прогулка' },
  { value: 'food', label: 'Еда' },
  { value: 'attraction', label: 'Место' },
  { value: 'relax', label: 'Отдых' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'activity', label: 'Событие' },
]

const draftKey = computed(() => `${DRAFT_KEY_PREFIX}${props.dayId}`)
const canSave = computed(() =>
  blocks.value.length > 0
  && blocks.value.every(b =>
    b.comment.trim()
    && (b.type !== 'activity' || b.title.trim())
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.time)))

watch(text, (val) => {
  saveDraft(val)

  if (hasRestoredDraft.value && !val.trim()) {
    hasRestoredDraft.value = false
  }
})
watch(() => props.visible, (visible) => {
  if (visible) {
    blocks.value = []
    preview.value = false
    error.value = ''
    transcriptionNotice.value = ''
    isVoicePanelOpen.value = false
    voiceRecorder.reset()
    loadDraft()
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
  else {
    voiceRecorder.reset()

    if (audioElementRef.value) {
      audioElementRef.value.pause()
    }
  }
})

// Черновик в localStorage
function loadDraft() {
  if (typeof window === 'undefined')
    return

  const saved = localStorage.getItem(draftKey.value)

  if (saved && saved.trim()) {
    text.value = saved
    hasRestoredDraft.value = true
  }
}
function saveDraft(val: string) {
  if (typeof window === 'undefined')
    return

  if (val.trim()) {
    localStorage.setItem(draftKey.value, val)
  }
  else {
    localStorage.removeItem(draftKey.value)
  }
}
function clearDraft() {
  text.value = ''
  hasRestoredDraft.value = false

  if (typeof window !== 'undefined') {
    localStorage.removeItem(draftKey.value)
  }
}
function adjustTextareaHeight() {
  if (!textareaRef.value)
    return

  textareaRef.value.style.height = 'auto'
  const newHeight = Math.min(Math.max(textareaRef.value.scrollHeight, 100), 220)
  textareaRef.value.style.height = `${newHeight}px`
}
function previewTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? parseTime(value) : null
}
function updateTime(block: MemoryProposal['blocks'][number], value: Time | null | undefined) {
  block.time = value?.toString().slice(0, 5) ?? ''
  block.timeEstimated = false
}

function close(value: boolean) {
  if (!busy.value && !transcribing.value) {
    voiceRecorder.reset()
    emit('update:visible', value)
  }
}
// Голосовой ввод
async function toggleVoiceRecording() {
  if (transcribing.value || busy.value)
    return

  if (!isVoicePanelOpen.value) {
    isVoicePanelOpen.value = true
  }

  if (voiceRecorder.status.value === 'idle') {
    const started = await voiceRecorder.start()

    if (!started && voiceRecorder.error.value) {
      error.value = voiceRecorder.error.value
    }
  }
  else if (voiceRecorder.status.value === 'recording') {
    voiceRecorder.pause()
  }
  else if (voiceRecorder.status.value === 'paused') {
    voiceRecorder.resume()
  }
}
function finishRecording() {
  voiceRecorder.stop()
}
function cancelRecording() {
  voiceRecorder.reset()
  isVoicePanelOpen.value = false
}
function toggleAudioPlayback() {
  if (!audioElementRef.value)
    return

  if (audioElementRef.value.paused) {
    audioElementRef.value.play()
    isAudioPlaying.value = true
  }
  else {
    audioElementRef.value.pause()
    isAudioPlaying.value = false
  }
}
function onAudioEnded() {
  isAudioPlaying.value = false
}
function prepareAudioFormData(): FormData {
  const blob = voiceRecorder.audioBlob.value!
  const mime = voiceRecorder.mimeType.value || blob.type || 'audio/webm'
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm'
  const audioFile = new File([blob], `story-recording.${ext}`, { type: mime })

  const formData = new FormData()
  formData.append('file', audioFile)

  const contextParts = [
    props.tripTitle ? `Путешествие: ${props.tripTitle}` : '',
    props.dayTitle ? `День: ${props.dayTitle}` : '',
  ].filter(Boolean)

  if (contextParts.length > 0) {
    formData.append('context', contextParts.join(', '))
  }

  return formData
}

function handleTranscribedResult(recognizedText: string) {
  text.value = text.value.trim() ? `${text.value.trim()}\n\n${recognizedText}` : recognizedText
  transcriptionNotice.value = 'Аудио успешно расшифровано. Проверьте или дополните рассказ.'
  isVoicePanelOpen.value = false
  voiceRecorder.reset()
  nextTick(() => {
    adjustTextareaHeight()
    textareaRef.value?.focus()
  })
}

// Распознавание записанного аудио через сервер (Gemini Whisper/Multimodal)
async function transcribeAudio() {
  if (!voiceRecorder.audioBlob.value || transcribing.value)
    return

  transcribing.value = true
  error.value = ''
  transcriptionNotice.value = ''

  try {
    const formData = prepareAudioFormData()
    const result = await useRequest({
      key: 'memories:transcribe-voice',
      fn: db => db.llm.transcribeMemoryVoice(formData),
    })

    if (result?.text?.trim()) {
      handleTranscribedResult(result.text.trim())
    }
    else {
      error.value = 'Распознавание завершилось без текста. Попробуйте записать ещё раз.'
    }
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Не удалось распознать голосовую запись.'
  }
  finally {
    transcribing.value = false
  }
}
// Генерация блоков воспоминаний
async function generate() {
  if (busy.value || !text.value.trim())
    return

  busy.value = true
  error.value = ''

  try {
    await useRequest({
      key: 'memories:generate',
      fn: db => db.memories.generate({ dayId: props.dayId, text: text.value }),
      onSuccess: (result) => {
        blocks.value = result.blocks
        preview.value = true
      },
      onError: ({ error: failure }) => {
        error.value = failure.customMessage || 'Не удалось подготовить воспоминания по рассказу.'
      },
    })
  }
  finally {
    busy.value = false
  }
}
// Сохранение блоков в день
async function save() {
  if (busy.value || !canSave.value)
    return

  busy.value = true
  error.value = ''

  try {
    await useRequest({
      key: 'memories:apply-generated',
      fn: db => db.memories.applyGenerated({ dayId: props.dayId, blocks: blocks.value }),
      onSuccess: (result) => {
        clearDraft()
        emit('saved', result)
        emit('update:visible', false)
      },
      onError: ({ error: failure }) => {
        error.value = failure.customMessage || 'Не удалось сохранить воспоминания.'
      },
    })
  }
  finally {
    busy.value = false
  }
}

onBeforeUnmount(() => {
  voiceRecorder.reset()
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :persistent="busy || transcribing"
    :title="preview ? 'Предпросмотр воспоминаний' : 'Создать воспоминание'"
    icon="mdi:auto-fix"
    :max-width="680"
    @update:visible="close"
  >
    <div class="sheet-content" :aria-busy="busy || transcribing">
      <!-- ЭТАП 1: ВВОД РАССКАЗА -->
      <template v-if="!preview">
        <p class="sheet-subtitle">
          Расскажи, что произошло. ИИ учтёт план дня и уже сохранённые воспоминания поездки, включая заметки и время событий.
        </p>

        <!-- Главная карточка рассказа -->
        <div class="story-card" :class="{ 'has-focus': false, 'is-recording': voiceRecorder.status.value === 'recording' }">
          <textarea
            ref="textareaRef"
            v-model="text"
            class="story-textarea"
            :disabled="busy || transcribing"
            placeholder="Сегодня гулял по старому Тайбэю, зашёл в храм, попробовал местную лапшу..."
            maxlength="20000"
            rows="3"
            @input="adjustTextareaHeight"
          />

          <!-- Нижняя панель внутри карточки -->
          <div class="story-card-bottom">
            <div class="story-status">
              <span v-if="voiceRecorder.status.value === 'recording'" class="recording-badge">
                <span class="recording-dot" />
                Запись {{ voiceRecorder.formattedDuration.value }}
              </span>
              <span v-else-if="voiceRecorder.status.value === 'paused'" class="paused-badge">
                <Icon icon="mdi:pause" />
                Пауза ({{ voiceRecorder.formattedDuration.value }})
              </span>
              <span v-else-if="transcribing" class="transcribing-badge">
                <Icon icon="mdi:loading" class="spin-icon" />
                Распознаём аудио…
              </span>
              <span v-else-if="hasRestoredDraft" class="draft-badge">
                <Icon icon="mdi:check-circle-outline" />
                Черновик
                <button
                  type="button"
                  class="draft-clear-btn"
                  title="Очистить черновик"
                  @click="clearDraft"
                >
                  ✕
                </button>
              </span>
              <span v-else class="status-hint">
                Текст или голос
              </span>
            </div>

            <!-- Круглая кнопка микрофона -->
            <button
              type="button"
              class="mic-btn"
              :class="{
                'is-recording': voiceRecorder.status.value === 'recording',
                'is-paused': voiceRecorder.status.value === 'paused',
                'is-active': isVoicePanelOpen,
              }"
              :disabled="busy || transcribing"
              :aria-label="voiceRecorder.status.value === 'recording' ? 'Приостановить запись' : 'Записать голос'"
              @click="toggleVoiceRecording"
            >
              <Icon
                :icon="voiceRecorder.status.value === 'recording' ? 'mdi:pause' : 'mdi:microphone'"
                class="mic-icon"
              />
            </button>
          </div>
        </div>

        <!-- Голосовая панель (раскрывается при записи или наличии записанного аудио) -->
        <Transition name="voice-panel-slide">
          <div v-if="isVoicePanelOpen" class="voice-panel">
            <!-- Режим записи / паузы -->
            <div v-if="voiceRecorder.status.value === 'recording' || voiceRecorder.status.value === 'paused'" class="voice-recording-view">
              <div class="waveform-anim">
                <span class="wave-bar" :class="{ paused: voiceRecorder.status.value === 'paused' }" />
                <span class="wave-bar" :class="{ paused: voiceRecorder.status.value === 'paused' }" />
                <span class="wave-bar" :class="{ paused: voiceRecorder.status.value === 'paused' }" />
                <span class="wave-bar" :class="{ paused: voiceRecorder.status.value === 'paused' }" />
                <span class="wave-bar" :class="{ paused: voiceRecorder.status.value === 'paused' }" />
              </div>

              <div class="voice-timer">
                {{ voiceRecorder.formattedDuration.value }}
              </div>

              <div class="voice-actions">
                <button
                  type="button"
                  class="voice-ctrl-btn"
                  :title="voiceRecorder.status.value === 'recording' ? 'Приостановить' : 'Продолжить'"
                  @click="toggleVoiceRecording"
                >
                  <Icon :icon="voiceRecorder.status.value === 'recording' ? 'mdi:pause' : 'mdi:play'" />
                  <span>{{ voiceRecorder.status.value === 'recording' ? 'Пауза' : 'Продолжить' }}</span>
                </button>

                <button
                  type="button"
                  class="voice-ctrl-btn primary"
                  title="Завершить запись"
                  @click="finishRecording"
                >
                  <Icon icon="mdi:check" />
                  <span>Завершить</span>
                </button>

                <button
                  type="button"
                  class="voice-ctrl-btn danger"
                  title="Отменить запись"
                  @click="cancelRecording"
                >
                  <Icon icon="mdi:delete-outline" />
                </button>
              </div>
            </div>

            <!-- Режим готовой аудиозаписи (прослушивание перед отправкой) -->
            <div v-else-if="voiceRecorder.audioUrl.value" class="voice-preview-view">
              <audio
                ref="audioElementRef"
                :src="voiceRecorder.audioUrl.value"
                class="hidden-audio"
                @ended="onAudioEnded"
              />

              <div class="voice-player-bar">
                <button
                  type="button"
                  class="player-play-btn"
                  :aria-label="isAudioPlaying ? 'Пауза' : 'Слушать'"
                  @click="toggleAudioPlayback"
                >
                  <Icon :icon="isAudioPlaying ? 'mdi:pause' : 'mdi:play'" />
                </button>
                <div class="player-info">
                  <span class="player-title">Голосовой рассказ</span>
                  <span class="player-meta">{{ voiceRecorder.formattedDuration.value }} • Готов к распознаванию</span>
                </div>
                <button
                  type="button"
                  class="player-delete-btn"
                  title="Удалить и перезаписать"
                  :disabled="transcribing"
                  @click="cancelRecording"
                >
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </div>

              <button
                type="button"
                class="transcribe-btn"
                :disabled="transcribing"
                @click="transcribeAudio"
              >
                <Icon :icon="transcribing ? 'mdi:loading' : 'mdi:auto-fix'" :class="{ 'spin-icon': transcribing }" />
                <span>{{ transcribing ? 'Распознаём аудио через ИИ…' : 'Распознать рассказ в текст' }}</span>
              </button>
            </div>
          </div>
        </Transition>

        <!-- Уведомление об успешной расшифровке -->
        <div v-if="transcriptionNotice" class="transcription-alert">
          <Icon icon="mdi:check-circle-outline" class="alert-icon" />
          <span>{{ transcriptionNotice }}</span>
        </div>

        <!-- Ошибка -->
        <div v-if="error" class="error-alert" role="alert">
          <Icon icon="mdi:alert-circle-outline" class="alert-icon" />
          <span>{{ error }}</span>
        </div>
      </template>

      <!-- ЭТАП 2: ПРЕДПРОСМОТР БЛОКОВ -->
      <template v-else>
        <p class="sheet-subtitle">
          ИИ структурировал ваш рассказ в блоки ({{ blocks.length }}). Проверьте текст и время перед сохранением:
        </p>

        <div class="blocks-list">
          <article
            v-for="(block, index) in blocks"
            :key="index"
            class="block-card"
            :class="`type-${block.type}`"
          >
            <!-- Шапка карточки блока -->
            <div class="block-card-header">
              <div class="block-badges">
                <span class="type-badge" :class="`badge-${block.type}`">
                  <Icon
                    :icon="block.type === 'activity' ? 'mdi:walk' : block.type === 'note' ? 'mdi:text-box-outline' : 'mdi:pencil-outline'"
                  />
                  {{ blockTypeLabels[block.type] }}
                </span>

                <span v-if="block.type === 'activity' && block.tag" class="tag-badge">
                  {{ tagOptions.find(t => t.value === block.tag)?.label || block.tag }}
                </span>

                <span v-if="block.timeEstimated" class="estimated-badge">
                  ~приблизительно
                </span>
              </div>

              <button
                type="button"
                class="block-remove-btn"
                title="Убрать блок"
                :disabled="busy"
                @click="blocks.splice(index, 1)"
              >
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </div>

            <div v-if="block.type === 'note' && block.targetId" class="note-target-info">
              <Icon icon="mdi:link-variant" />
              <span>Заметка к активности: {{ existing.find(m => m.id === block.targetId)?.title || 'Активность выбранного дня' }}</span>
            </div>

            <!-- Поля ввода активности -->
            <div v-if="block.type === 'activity'" class="block-field">
              <KitInput
                v-model="block.title"
                label="Название активности"
                :disabled="busy"
                :maxlength="300"
                placeholder="Прогулка по старому городу"
              />
            </div>

            <!-- Время блока -->
            <div class="block-time-row">
              <span class="time-label">Время</span>
              <KitTimeField
                :model-value="previewTime(block.time)"
                :disabled="busy"
                :hour-cycle="24"
                @update:model-value="updateTime(block, $event)"
              />
            </div>

            <!-- Описание блока -->
            <div class="block-field">
              <KitInput
                v-model="block.comment"
                type="textarea"
                label="Текст воспоминания"
                :disabled="busy"
                :maxlength="10000"
                rows="3"
              />
            </div>
          </article>
        </div>

        <div v-if="error" class="error-alert" role="alert">
          <Icon icon="mdi:alert-circle-outline" class="alert-icon" />
          <span>{{ error }}</span>
        </div>
      </template>
    </div>

    <!-- ФУТЕР БОТТОМ ШИТА -->
    <template #footer>
      <!-- Футер этапа ввода -->
      <div v-if="!preview" class="footer-input-mode">
        <div class="trust-note">
          <Icon icon="mdi:shield-check-outline" class="trust-icon" />
          <span>Перед сохранением можно проверить и изменить результат</span>
        </div>

        <KitBtn
          class="primary-action-btn"
          :disabled="busy || transcribing || !text.trim()"
          @click="generate"
        >
          <Icon :icon="busy ? 'mdi:loading' : 'mdi:auto-fix'" :class="{ 'spin-icon': busy }" />
          <span>{{ busy ? 'Готовим воспоминания…' : 'Создать предпросмотр' }}</span>
        </KitBtn>
      </div>

      <!-- Футер этапа предпросмотра -->
      <div v-else class="footer-preview-mode">
        <KitBtn
          variant="outlined"
          color="secondary"
          :disabled="busy"
          @click="preview = false"
        >
          <Icon icon="mdi:arrow-left" />
          <span>К рассказу</span>
        </KitBtn>

        <KitBtn
          class="primary-action-btn"
          :disabled="busy || !canSave"
          @click="save"
        >
          <Icon :icon="busy ? 'mdi:loading' : 'mdi:check'" :class="{ 'spin-icon': busy }" />
          <span>{{ busy ? 'Сохраняем…' : `Сохранить (${blocks.length})` }}</span>
        </KitBtn>
      </div>
    </template>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.sheet-content {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sheet-subtitle {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--fg-secondary-color);
}

// Карточка ввода рассказа
.story-card {
  position: relative;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus-within {
    border-color: var(--fg-accent-color);
  }

  &.is-recording {
    border-color: var(--fg-error-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--fg-error-color) 15%, transparent);
  }
}

.story-textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.9375rem;
  line-height: 1.5;
  resize: none;
  min-height: 100px;
  max-height: 220px;
  overflow-y: auto;

  &::placeholder {
    color: var(--fg-muted-color);
  }
}

.story-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.story-status {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  min-width: 0;
}

.status-hint {
  color: var(--fg-secondary-color);
}

.draft-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fg-accent-color);
  font-weight: 500;

  .draft-clear-btn {
    border: none;
    background: transparent;
    color: var(--fg-muted-color);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0 4px;

    &:hover {
      color: var(--fg-primary-color);
    }
  }
}

.recording-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-error-color);
  font-weight: 600;
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--fg-error-color);
  animation: pulse-dot 1.2s infinite ease-in-out;
}

.paused-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fg-warning-color);
  font-weight: 500;
}

.transcribing-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-accent-color);
  font-weight: 500;
}

// Кнопка микрофона
.mic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;

  .mic-icon {
    font-size: 1.25rem;
    color: var(--fg-accent-color);
  }

  &:hover {
    background: var(--bg-hover-color);
    transform: scale(1.05);
  }

  &.is-recording {
    background: var(--fg-error-color);
    border-color: var(--fg-error-color);
    animation: mic-pulse 1.4s infinite;

    .mic-icon {
      color: var(--fg-inverted-color);
    }
  }

  &.is-paused {
    background: var(--fg-warning-color);
    border-color: var(--fg-warning-color);

    .mic-icon {
      color: var(--fg-inverted-color);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Голосовая панель
.voice-panel {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-recording-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.waveform-anim {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 24px;
}

.wave-bar {
  width: 3px;
  height: 100%;
  background-color: var(--fg-error-color);
  border-radius: 2px;
  animation: wave 1s infinite ease-in-out;

  &:nth-child(2) {
    animation-delay: 0.15s;
  }
  &:nth-child(3) {
    animation-delay: 0.3s;
  }
  &:nth-child(4) {
    animation-delay: 0.45s;
  }
  &:nth-child(5) {
    animation-delay: 0.6s;
  }

  &.paused {
    animation-play-state: paused;
    background-color: var(--fg-warning-color);
  }
}

.voice-timer {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  font-variant-numeric: tabular-nums;
}

.voice-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.voice-ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover-color);
  }

  &.primary {
    background: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);

    &:hover {
      opacity: 0.92;
    }
  }

  &.danger {
    color: var(--fg-error-color);
    padding: 6px 10px;

    &:hover {
      background: color-mix(in srgb, var(--fg-error-color) 12%, transparent);
    }
  }
}

// Плеер записанного аудио
.voice-preview-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hidden-audio {
  display: none;
}

.voice-player-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-primary-color);
  padding: 8px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
}

.player-play-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--fg-accent-color);
  color: var(--fg-inverted-color);
  cursor: pointer;
  font-size: 1.125rem;
  flex-shrink: 0;

  &:hover {
    transform: scale(1.05);
  }
}

.player-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.player-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.player-meta {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
}

.player-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-xs);
  border: none;
  background: transparent;
  color: var(--fg-muted-color);
  cursor: pointer;
  font-size: 1.125rem;

  &:hover {
    color: var(--fg-error-color);
    background: color-mix(in srgb, var(--fg-error-color) 10%, transparent);
  }
}

.transcribe-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border-radius: var(--r-s);
  border: none;
  background: var(--fg-accent-color);
  color: var(--fg-inverted-color);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.95;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// Уведомления и алерты
.transcription-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-s);
  background: color-mix(in srgb, var(--fg-success-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fg-success-color) 25%, transparent);
  color: var(--fg-success-color);
  font-size: 0.8125rem;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-s);
  background: color-mix(in srgb, var(--fg-error-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fg-error-color) 25%, transparent);
  color: var(--fg-error-color);
  font-size: 0.8125rem;
}

// Список блоков в предпросмотре
.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}

.block-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &.type-activity {
    border-left: 3px solid var(--fg-accent-color);
  }

  &.type-note {
    border-left: 3px solid var(--fg-info-color);
  }
}

.block-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.block-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--r-xs);

  &.badge-activity {
    background: color-mix(in srgb, var(--fg-accent-color) 15%, transparent);
    color: var(--fg-accent-color);
  }

  &.badge-note {
    background: color-mix(in srgb, var(--fg-info-color) 15%, transparent);
    color: var(--fg-info-color);
  }
}

.tag-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--bg-hover-color);
  color: var(--fg-secondary-color);
}

.estimated-badge {
  font-size: 0.6875rem;
  color: var(--fg-muted-color);
  font-style: italic;
}

.block-remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--fg-muted-color);
  border-radius: var(--r-xs);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-error-color);
    background: color-mix(in srgb, var(--fg-error-color) 10%, transparent);
  }
}

.note-target-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--fg-secondary-color);
}

.block-time-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 140px;
}

// Футер
.footer-input-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trust-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--fg-secondary-color);

  .trust-icon {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }
}

.primary-action-btn {
  width: 100%;
  min-height: 44px;
}

.footer-preview-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  .primary-action-btn {
    flex: 1;
  }
}

.spin-icon {
  animation: spin 1s infinite linear;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

@keyframes mic-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--fg-error-color) 50%, transparent);
  }
  70% {
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--fg-error-color) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--fg-error-color) 0%, transparent);
  }
}

@keyframes wave {
  0%,
  100% {
    height: 6px;
  }
  50% {
    height: 22px;
  }
}

// Transitions
.voice-panel-slide-enter-active,
.voice-panel-slide-leave-active {
  transition: all 0.25s ease;
}

.voice-panel-slide-enter-from,
.voice-panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
