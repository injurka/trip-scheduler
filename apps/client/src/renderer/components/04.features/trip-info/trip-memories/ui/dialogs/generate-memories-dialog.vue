<script setup lang="ts">
import type { Memory, MemoryProposal } from '~/shared/types/models/memory'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitMarkdownViewer } from '~/components/01.kit/kit-markdown-viewer'
import { useRequest } from '~/plugins/request'

interface Props {
  visible: boolean
  dayId: string
  existing: Memory[]
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'saved': [memories: Memory[]]
}>()
const text = ref('')
const blocks = ref<MemoryProposal['blocks']>([])
const busy = ref(false)
const error = ref('')
const preview = ref(false)
const labels = { activity: 'Новая активность', note: 'Новая заметка', description: 'Изменение описания' }
const canSave = computed(() => blocks.value.length > 0 && blocks.value.every(b =>
  b.comment.trim() && (b.type !== 'activity' || b.title.trim()) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.time)))

watch(() => props.visible, (visible) => {
  if (visible) {
    text.value = ''
    blocks.value = []
    preview.value = false
    error.value = ''
  }
})
function close(value: boolean) {
  if (!busy.value)
    emit('update:visible', value)
}
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
      onError: ({ error: failure }) => { error.value = failure.customMessage },
    })
  }
  finally { busy.value = false }
}
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
        emit('saved', result)
        emit('update:visible', false)
      },
      onError: ({ error: failure }) => { error.value = failure.customMessage },
    })
  }
  finally { busy.value = false }
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Воспоминания по рассказу"
    icon="mdi:auto-fix"
    @update:visible="close"
  >
    <div class="generation-body" :aria-busy="busy">
      <template v-if="!preview">
        <p>Расскажите, что произошло: события, впечатления, вещи или уточнения к существующим описаниям. ИИ исправит текст и предложит блоки для выбранного дня.</p>
        <KitInput
          v-model="text"
          type="textarea"
          label="Ваш рассказ"
          :disabled="busy"
          :maxlength="20000"
          placeholder="В 10 гуляли по набережной, потом обедали. Добавь к прогулке: было ветрено…"
        />
        <p>После OK появится предпросмотр. Сохранение — только после проверки.</p>
      </template>
      <template v-else>
        <p>Будет применено блоков: {{ blocks.length }}. Проверьте текст и время, отредактируйте или удалите лишнее.</p>
        <article v-for="(block, index) in blocks" :key="index" class="preview-block">
          <strong>{{ labels[block.type] }}</strong>
          <template v-if="block.type === 'description'">
            <p>{{ existing.find(m => m.id === block.targetId)?.title || 'Заметка / медиа' }}</p>
            <details>
              <summary>Прежнее описание</summary>
              <p>{{ existing.find(m => m.id === block.targetId)?.comment || 'Описание отсутствует' }}</p>
            </details>
          </template>
          <KitInput
            v-if="block.type === 'activity'"
            v-model="block.title"
            label="Название"
            :disabled="busy"
            :maxlength="300"
          />
          <KitInput
            v-if="block.type !== 'description'"
            v-model="block.time"
            type="time"
            label="Время"
            :disabled="busy"
          />
          <small v-if="block.timeEstimated && block.type !== 'description'">Время приблизительное — уточните при необходимости.</small>
          <KitInput
            v-model="block.comment"
            type="textarea"
            label="Итоговое описание"
            :disabled="busy"
            :maxlength="10000"
          />
          <KitMarkdownViewer :markdown="block.comment" />
          <KitBtn
            variant="text"
            color="secondary"
            :disabled="busy"
            @click="blocks.splice(index, 1)"
          >
            Убрать блок
          </KitBtn>
        </article>
      </template>
      <p v-if="error" role="alert">
        {{ error }}
      </p>
      <p v-if="busy" role="status">
        {{ preview ? 'Сохраняем изменения…' : 'Готовим воспоминания…' }}
      </p>
      <div class="generation-actions">
        <KitBtn
          variant="text"
          color="secondary"
          :disabled="busy"
          @click="preview ? (preview = false) : close(false)"
        >
          {{ preview ? 'К рассказу' : 'Отмена' }}
        </KitBtn>
        <KitBtn v-if="!preview" :disabled="busy || !text.trim()" @click="generate">
          OK — создать предпросмотр
        </KitBtn>
        <KitBtn v-else :disabled="busy || !canSave" @click="save">
          Добавить изменения
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.generation-body,
.preview-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.generation-body {
  max-height: 75vh;
  overflow-y: auto;
}
.preview-block {
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}
.generation-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
</style>
