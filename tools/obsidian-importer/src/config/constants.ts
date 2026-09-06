export const DEFAULT_TRIP_SECTIONS: Array<{ type: string, title: string, icon: string }> = [
  {
    type: 'bookings',
    title: 'Бронирования',
    icon: 'mdi:book-multiple-outline',
  },
  {
    type: 'checklist',
    title: 'Чек-листы',
    icon: 'mdi:format-list-checks',
  },
  {
    type: 'finances',
    title: 'Финансы',
    icon: 'mdi:cash-multiple',
  },
  {
    type: 'memories',
    title: 'Галерея воспоминаний',
    icon: 'mdi:image-filter-hdr',
  },
  {
    type: 'notes',
    title: 'Заметки',
    icon: 'mdi:note-edit-outline',
  },
  {
    type: 'documents',
    title: 'Документы',
    icon: 'mdi:file-document-multiple-outline',
  },
]

export const AIHUBMIX_MODELS: Array<{ title: string, value: string }> = [
  { title: '⚡ Google Gemini 3.8 Flash (Рекомендуется: быстрая, умная)', value: 'gemini-3.8-flash' },
  { title: '🪶 Google Gemini 3.5 Flash Lite (Супер-быстрая и экономная)', value: 'gemini-3.5-flash-lite' },
  { title: '🧠 Google Gemini 3.1 Pro (Максимальное качество и глубокий контекст)', value: 'gemini-3.1-pro-preview' },
  { title: '🎭 Anthropic Claude Sonnet 5 (Новейший Sonnet: лучший баланс)', value: 'claude-sonnet-5' },
  { title: '🏛️ Anthropic Claude Opus 5 (Флагман Anthropic)', value: 'claude-opus-5' },
  { title: '🤖 OpenAI GPT-5.6 Terra (Баланс цены и качества)', value: 'gpt-5.6-terra' },
  { title: '🚀 OpenAI GPT-5.6 Sol (Флагман OpenAI)', value: 'gpt-5.6-sol' },
  { title: '💡 OpenAI GPT-5.6 Luna (Быстрый и экономичный)', value: 'gpt-5.6-luna' },
  { title: '🛸 DeepSeek V4 Flash (Быстрая и дешёвая MoE)', value: 'deepseek-v4-flash-0731' },
  { title: '🐋 DeepSeek V4 Pro (Сильные рассуждения и агентные задачи)', value: 'deepseek-v4-pro-0813' },
  { title: '🧩 Z.AI GLM 5.3 Flash (Быстрая мультимодальная, 1M контекст)', value: 'glm-5.3-flash' },
  { title: '🔀 AIHubMix Auto Router (Авто-выбор модели под запрос, бета)', value: 'auto' },
  { title: '✍️  Ввести другое название модели вручную...', value: 'custom' },
]

export const DEFAULT_AIHUBMIX_MODEL = 'gemini-3.8-flash'
