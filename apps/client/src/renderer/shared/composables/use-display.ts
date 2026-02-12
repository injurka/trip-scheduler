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
  const width = ref(0)

  const updateWidth = () => {
    if (typeof window !== 'undefined') {
      width.value = window.innerWidth
    }
  }

  onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })

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

  const xs = computed(() => width.value < breakpoints.sm)
  const sm = computed(() => width.value >= breakpoints.sm && width.value < breakpoints.md)
  const md = computed(() => width.value >= breakpoints.md && width.value < breakpoints.lg)
  const lg = computed(() => width.value >= breakpoints.lg && width.value < breakpoints.xl)
  const xl = computed(() => width.value >= breakpoints.xl && width.value < breakpoints.xxl)
  const xxl = computed(() => width.value >= breakpoints.xxl)

  const mobile = computed(() => width.value < breakpoints.md) // xs и sm

  const smAndUp = computed(() => width.value >= breakpoints.sm)
  const mdAndUp = computed(() => width.value >= breakpoints.md)
  const lgAndUp = computed(() => width.value >= breakpoints.lg)
  const xlAndUp = computed(() => width.value >= breakpoints.xl)

  const smAndDown = computed(() => width.value < breakpoints.md)
  const mdAndDown = computed(() => width.value < breakpoints.lg)
  const lgAndDown = computed(() => width.value < breakpoints.xl)
  const xlAndDown = computed(() => width.value < breakpoints.xxl)

  return {
    width,
    name,
    xs,
    sm,
    md,
    lg,
    xl,
    xxl,
    mobile,
    smAndUp,
    mdAndUp,
    lgAndUp,
    xlAndUp,
    smAndDown,
    mdAndDown,
    lgAndDown,
    xlAndDown,
  }
}
