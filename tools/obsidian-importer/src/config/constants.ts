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
  { title: '⚡ Google Gemini 2.5 Flash (Рекомендуется: быстрая, умная)', value: 'gemini-2.5-flash' },
  { title: '🪶 Google Gemini 2.5 Flash Lite (Супер-быстрая и экономная)', value: 'gemini-2.5-flash-lite' },
  { title: '🧠 Google Gemini 2.5 Pro (Максимальное качество и глубокий контекст)', value: 'gemini-2.5-pro' },
  { title: '🎭 Anthropic Claude 3.7 Sonnet (Новейшая флагманская модель)', value: 'claude-3-7-sonnet-20250219' },
  { title: '🎨 Anthropic Claude 3.5 Sonnet (Высокая детализация)', value: 'claude-3-5-sonnet-20241022' },
  { title: '⚡ Anthropic Claude 3.5 Haiku (Быстрый Claude)', value: 'claude-3-5-haiku-20241022' },
  { title: '🚀 DeepSeek Flash (baidu-deepseek-v4-flash)', value: 'baidu-deepseek-v4-flash' },
  { title: '🛸 DeepSeek V3 (deepseek-chat)', value: 'deepseek-chat' },
  { title: '🤖 OpenAI GPT-4o (Флагман OpenAI)', value: 'gpt-4o' },
  { title: '💡 OpenAI GPT-4o Mini (Быстрый и экономичный)', value: 'gpt-4o-mini' },
  { title: '✍️  Ввести другое название модели вручную...', value: 'custom' },
]

export const DEFAULT_AIHUBMIX_MODEL = 'gemini-2.5-flash'
