export function variableNameToHumanReadable(name: string): string {
  const translations: Record<string, string> = {
    'color': 'Цвет',
    'r': 'Радиус',
    'bg': 'Фон',
    'fg': 'Текст',
    'border': 'Граница',
    'primary': 'Основной',
    'secondary': 'Второстепенный',
    'tertiary': 'Третичный',
    'accent': 'Акцент',
    'header': 'Заголовок',
    'focus': 'Фокус',
    'hover': 'Наведение',
    'disabled': 'Отключенный',
    'success': 'Успех',
    'warning': 'Предупреждение',
    'error': 'Ошибка',
    'info': 'Информация',
    'highlight': 'Подсветка',
    'pressed': 'Нажатие',
    'action': 'Действие',
    'inverted': 'Инвертированный',
    'muted': 'Приглушенный',
    'overlay': 'Наложение',
    'button': 'Кнопка',
    'full': 'Полный',
    '2xl': 'Огромный',
    'xl': 'Очень большой',
    'l': 'Большой',
    'm': 'Средний',
    's': 'Маленький',
    'xs': 'Очень маленький',
    '2xs': 'Крошечный',
  }

  return name
    .replace(/-/g, ' ') // Превращаем 'r-2xl' в 'r 2xl'
    .split(' ') // Превращаем 'r 2xl' в массив ['r', '2xl']
    .map(word => translations[word.toLowerCase()] || word)
    .join(' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}
