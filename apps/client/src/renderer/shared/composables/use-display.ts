export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
  xxl: 2560,
}

/**
 * @description Реактивный composable для отслеживания размеров экрана.
 * Предоставляет информацию о текущем брейкпоинте и удобные флаги.
 *
 * @example
 * const { mobile, smAndUp, name } = useDisplay();
 *
 * if (smAndUp.value) {
 *   // Логика для экранов от 600px и выше
 * }
 *
 * console.log(name.value) // -> 'lg'
 */
export function useDisplay() {
  // Состояние для хранения ширины окна.
  // Инициализируем нулем для безопасности на сервере, где `window` недоступен.
  const width = ref(0)

  // Функция обновления ширины
  const updateWidth = () => {
    // Проверяем, что код выполняется в браузере
    if (typeof window !== 'undefined') {
      width.value = window.innerWidth
    }
  }

  // Жизненные циклы Vue
  onMounted(() => {
    // Устанавливаем начальное значение при монтировании компонента
    updateWidth()
    // Добавляем слушатель события resize
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    // Удаляем слушатель при размонтировании для предотвращения утечек памяти
    window.removeEventListener('resize', updateWidth)
  })

  // --- Вычисляемые свойства (Computed Properties) ---

  // Имя текущего брейкпоинта (e.g., 'xs', 'sm', 'md')
  const name = computed(() => {
    const screenWidth = width.value
    if (screenWidth < breakpoints.sm)
      return 'xs'
    if (screenWidth < breakpoints.md)
      return 'sm'
    if (screenWidth < breakpoints.lg)
      return 'md'
    if (screenWidth < breakpoints.xl)
      return 'lg'
    if (screenWidth < breakpoints.xxl)
      return 'xl'
    return 'xxl'
  })

  // --- Основные флаги для конкретных диапазонов ---

  const xs = computed(() => width.value < breakpoints.sm)
  const sm = computed(() => width.value >= breakpoints.sm && width.value < breakpoints.md)
  const md = computed(() => width.value >= breakpoints.md && width.value < breakpoints.lg)
  const lg = computed(() => width.value >= breakpoints.lg && width.value < breakpoints.xl)
  const xl = computed(() => width.value >= breakpoints.xl && width.value < breakpoints.xxl)
  const xxl = computed(() => width.value >= breakpoints.xxl)

  // Флаг для мобильных устройств (самый частый кейс)
  const mobile = computed(() => width.value < breakpoints.md) // xs и sm

  // --- Флаги "И ВЫШЕ" (And Up) ---

  const smAndUp = computed(() => width.value >= breakpoints.sm)
  const mdAndUp = computed(() => width.value >= breakpoints.md)
  const lgAndUp = computed(() => width.value >= breakpoints.lg)
  const xlAndUp = computed(() => width.value >= breakpoints.xl)

  // --- Флаги "И НИЖЕ" (And Down) ---

  const smAndDown = computed(() => width.value < breakpoints.md)
  const mdAndDown = computed(() => width.value < breakpoints.lg)
  const lgAndDown = computed(() => width.value < breakpoints.xl)
  const xlAndDown = computed(() => width.value < breakpoints.xxl)

  // Возвращаем публичный API хука
  return {
    // Состояние
    width,
    // Имя брейкпоинта
    name,
    // Флаги диапазонов
    xs,
    sm,
    md,
    lg,
    xl,
    xxl,
    // Удобный флаг для мобильных
    mobile,
    // Флаги "И ВЫШЕ"
    smAndUp,
    mdAndUp,
    lgAndUp,
    xlAndUp,
    // Флаги "И НИЖЕ"
    smAndDown,
    mdAndDown,
    lgAndDown,
    xlAndDown,
  }
}
