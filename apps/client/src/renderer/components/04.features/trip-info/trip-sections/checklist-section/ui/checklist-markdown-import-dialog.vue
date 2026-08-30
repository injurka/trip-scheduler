<script setup lang="ts">
import type { ParsedMarkdownResult } from '../lib/markdown-checklist-parser'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { parseMarkdownToChecklist } from '../lib/markdown-checklist-parser'

interface Props {
  visible: boolean
  currentTabName: string
  currentTabId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'import', result: ParsedMarkdownResult, mode: 'current-tab' | 'auto-tabs'): void
}>()

const markdownInput = ref('')
const importMode = ref<'current-tab' | 'auto-tabs'>('current-tab')

const parsedResult = computed<ParsedMarkdownResult>(() => {
  if (!markdownInput.value.trim()) {
    return {
      tabs: [],
      groups: [],
      items: [],
      stats: { tabsCount: 0, groupsCount: 0, itemsCount: 0, subtasksCount: 0 },
    }
  }
  return parseMarkdownToChecklist(markdownInput.value, props.currentTabId, importMode.value)
})

const hasTasks = computed(() => parsedResult.value.items.length > 0)

function loadTaiwanExample() {
  markdownInput.value = `# 🧳 Подготовка и Сборы

## 🪪 Документы и Въезд
- [ ] **Загранпаспорт:** Срок действия более 6 месяцев, чистые страницы.
- [ ] **Регистрация в Lucky Land:** Заполнена на сайте \`5000.taiwan.net.tw\` за 1–7 дней до прилета (шанс выиграть 5000 TWD).
- [ ] **Электронная миграционная карта (TWAC):** Заполнена онлайн на \`niaspeedy.immigration.gov.tw\` за 1–3 дня.
- [ ] **Медицинская страховка:** Полис ВЗР с покрытием от $50 000 с опцией активного отдыха.

## 💻 Воркейшн и Техника
- [ ] **Рабочий ноутбук:** Проверен аккумулятор, очищен диск.
- [ ] **Комплект кабелей:**
  - [ ] 2x Type-C ➔ Type-C (с поддержкой 100W PD)
  - [ ] 1x Type-C ➔ Lightning / USB-C для смартфона
  - [ ] Магнитный кабель для зарядки смарт-часов
- [ ] **Адаптеры питания (Type A/B):** 2–3 штуки на 110V.

## 🚨 Таможенные запреты (Критично)
- [ ] ❌ **Мясные продукты:** Категорический запрет (штраф ~560 000 ₽ / депортация!).
- [ ] ❌ **Электронные сигареты и вейпы:** Вейпы и IQOS запрещены (штраф от ~140 000 ₽).

# 🍜 Must-Try и Покупки

## 🏮 Стритфуд ночных рынков
- [ ] **Хуцзяобин (Hu Jiao Bing) — Перечные булочки из тандыра**
  - *Что это:* Хрустящая булочка с сочной свининой и луком
  - *Где пробовать:* Ночной рынок Раохэ (~65 TWD / ~180 ₽)
- [ ] **Сяолунбао (Xiao Long Bao) — Паровые пельмени**
  - *Что это:* 18 складок, бульон внутри
  - *Где пробовать:* Din Tai Fung Taipei 101 (~280 TWD)
- [ ] **Оригинальный Bubble Tea в Chun Shui Tang**
  - *Секрет заказа:* Сахар 30% (Wei Tang), Без льда (Qu Bing)
  - *Где пробовать:* Chun Shui Tang в Тайчжуне (~120 TWD)
`
  importMode.value = 'auto-tabs'
}

function handleImport() {
  if (!hasTasks.value)
    return
  emit('import', parsedResult.value, importMode.value)
  emit('update:visible', false)
  markdownInput.value = ''
}

watch(() => props.visible, (isOpen) => {
  if (!isOpen) {
    markdownInput.value = ''
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Импорт задач из Markdown"
    icon="mdi:file-import-outline"
    :max-width="700"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="import-dialog-content">
      <p class="description">
        Вставьте любой текст со списками <code>- [ ]</code> и заголовками <code>##</code>. Парсер автоматически создаст группы, задачи, подпункты, ссылки и цены.
      </p>

      <div class="mode-selector">
        <label class="mode-label">Режим импорта:</label>
        <div class="mode-radios">
          <label class="mode-option" :class="{ active: importMode === 'current-tab' }">
            <input v-model="importMode" type="radio" value="current-tab">
            <span>В текущую вкладку (<strong>{{ currentTabName }}</strong>)</span>
          </label>
          <label class="mode-option" :class="{ active: importMode === 'auto-tabs' }">
            <input v-model="importMode" type="radio" value="auto-tabs">
            <span>Создавать вкладки по заголовкам <code>#</code></span>
          </label>
        </div>
      </div>

      <div class="textarea-wrapper">
        <textarea
          v-model="markdownInput"
          placeholder="## Документы&#10;- [ ] Загранпаспорт&#10;- [ ] Авиабилеты&#10;&#10;## Гастрономия&#10;- [ ] Перечные булочки (~65 TWD)&#10;  - [ ] Острый соус"
          class="markdown-textarea"
          rows="12"
        />
      </div>

      <!-- Live preview summary -->
      <div v-if="markdownInput.trim()" class="preview-stats">
        <div class="stat-badge">
          <Icon icon="mdi:folder-outline" />
          <span>Групп: <strong>{{ parsedResult.stats.groupsCount }}</strong></span>
        </div>
        <div class="stat-badge">
          <Icon icon="mdi:checkbox-marked-outline" />
          <span>Задач: <strong>{{ parsedResult.stats.itemsCount }}</strong></span>
        </div>
        <div v-if="parsedResult.stats.subtasksCount > 0" class="stat-badge">
          <Icon icon="mdi:format-list-bulleted" />
          <span>Подзадач: <strong>{{ parsedResult.stats.subtasksCount }}</strong></span>
        </div>
        <div v-if="importMode === 'auto-tabs' && parsedResult.stats.tabsCount > 0" class="stat-badge accent">
          <Icon icon="mdi:tab" />
          <span>Вкладок: <strong>{{ parsedResult.stats.tabsCount }}</strong></span>
        </div>
      </div>

      <div class="quick-examples">
        <KitBtn variant="subtle" size="sm" icon="mdi:file-document-refresh-outline" @click="loadTaiwanExample">
          Загрузить демо-манифест Тайваня
        </KitBtn>
        <KitBtn v-if="markdownInput" variant="text" size="sm" color="secondary" @click="markdownInput = ''">
          Очистить
        </KitBtn>
      </div>

      <KitDivider />

      <div class="dialog-actions">
        <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn :disabled="!hasTasks" icon="mdi:check" @click="handleImport">
          Импортировать ({{ parsedResult.stats.itemsCount }} задач)
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.import-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.25rem;
}

.description {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  line-height: 1.4;

  code {
    background: var(--bg-tertiary-color);
    padding: 2px 4px;
    border-radius: var(--r-xs);
    font-size: 0.85rem;
  }
}

.mode-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-secondary-color);
  padding: 8px 12px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.mode-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
}

.mode-radios {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--fg-primary-color);

  input {
    cursor: pointer;
  }

  &.active {
    color: var(--fg-accent-color);
    font-weight: 500;
  }
}

.textarea-wrapper {
  display: flex;
  flex-direction: column;
}

.markdown-textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  color: var(--fg-primary-color);
  font-family: var(--font-mono, monospace);
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 180px;

  &:focus {
    outline: none;
    border-color: var(--fg-accent-color);
  }
}

.preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-full);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.8rem;
  color: var(--fg-secondary-color);

  strong {
    color: var(--fg-primary-color);
  }

  &.accent {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }
}

.quick-examples {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
