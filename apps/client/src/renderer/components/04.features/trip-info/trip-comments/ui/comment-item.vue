<script setup lang="ts">
import type { UseTimeAgoMessages } from '@vueuse/core'
import type { Comment } from '~/shared/types/models/comment'
import { Icon } from '@iconify/vue'
import { useTimeAgo } from '@vueuse/core'
import { KitAvatar } from '~/components/01.kit/kit-avatar'
import { useAuthStore } from '~/shared/store/auth.store'

interface Props {
  comment: Comment
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'delete'): void
}>()

const authStore = useAuthStore()
const confirm = useConfirm()

// --- Функция для правильного склонения слов ---
function getPlural(n: number, one: string, two: string, five: string) {
  let num = Math.abs(n)
  num %= 100
  if (num >= 5 && num <= 20)
    return five

  num %= 10
  if (num === 1)
    return one

  if (num >= 2 && num <= 4)
    return two

  return five
}

const messages: UseTimeAgoMessages = {
  justNow: 'только что',
  past: n => `${n} назад`,
  future: n => `через ${n}`,
  month: (n, past) => n === 1 ? (past ? 'месяц' : 'через месяц') : `${n} ${getPlural(n, 'месяц', 'месяца', 'месяцев')}`,
  year: (n, past) => n === 1 ? (past ? 'год' : 'через год') : `${n} ${getPlural(n, 'год', 'года', 'лет')}`,
  day: (n, past) => n === 1 ? (past ? 'вчера' : 'завтра') : `${n} ${getPlural(n, 'день', 'дня', 'дней')}`,
  week: (n, past) => n === 1 ? (past ? 'неделю' : 'через неделю') : `${n} ${getPlural(n, 'неделю', 'недели', 'недель')}`,
  hour: n => `${n} ${getPlural(n, 'час', 'часа', 'часов')}`,
  minute: n => `${n} ${getPlural(n, 'минуту', 'минуты', 'минут')}`,
  second: n => `${n} ${getPlural(n, 'секунду', 'секунды', 'секунд')}`,
  invalid: 'некорректная дата',
}

const timeAgo = useTimeAgo(new Date(props.comment.createdAt), { messages })

const canDelete = computed(() => {
  return authStore.user?.id === props.comment.user.id
})

async function handleDelete() {
  const isConfirmed = await confirm({
    title: 'Удалить комментарий?',
    description: 'Это действие необратимо.',
  })
  if (isConfirmed) {
    emit('delete')
  }
}
</script>

<template>
  <div class="comment-item">
    <KitAvatar
      :src="comment.user.avatarUrl"
      :name="comment.user.name"
      :size="32"
      style="flex-shrink: 0;"
    />
    <div class="comment-body">
      <div class="comment-header">
        <span class="author-name">{{ comment.user.name }}</span>
        <span class="timestamp">{{ timeAgo }}</span>
        <div v-if="canDelete" class="comment-actions">
          <button title="Удалить" @click="handleDelete">
            <Icon icon="mdi:trash-can-outline" />
          </button>
        </div>
      </div>
      <p class="comment-text">
        {{ comment.text }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.comment-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 8px 0;

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 16px;
    top: 40px;
    bottom: -8px;
    width: 2px;
    background-color: var(--border-secondary-color);
  }
}

.comment-body {
  flex-grow: 1;
  min-width: 0;
}

.comment-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  padding-right: 28px;
}

.author-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.timestamp {
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
  flex-shrink: 0;
}

.comment-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-actions {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s ease;

  button {
    color: var(--fg-tertiary-color);
    &:hover {
      color: var(--fg-error-color);
    }
  }
}

.comment-item:hover .comment-actions {
  opacity: 1;
}
</style>
