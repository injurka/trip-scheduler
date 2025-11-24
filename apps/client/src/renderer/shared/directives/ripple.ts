import type { Directive } from 'vue'

// Стили для ripple-элемента добавим динамически или можно вынести в глобальный SCSS
const rippleStyle = `
.kit-ripple-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
}

.kit-ripple-element {
  position: absolute;
  border-radius: 50%;
  transform: scale(0);
  background-color: currentColor;
  opacity: 0.25;
  pointer-events: none;
  animation: kit-ripple-effect 0.6s linear;
}

@keyframes kit-ripple-effect {
  to {
    transform: scale(4);
    opacity: 0;
  }
}
`

// Добавляем стили в head один раз
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.innerHTML = rippleStyle
  document.head.appendChild(style)
}

const vRipple: Directive = {
  mounted(el) {
    // Убедимся, что родитель имеет позиционирование (хотя контейнер риппла будет абсолютным)
    const computedStyle = window.getComputedStyle(el)
    if (computedStyle.position === 'static') {
      el.style.position = 'relative'
    }

    // Создаем контейнер для рипплов, чтобы они не вылезали за границы,
    // если у самого элемента нет overflow: hidden
    const container = document.createElement('div')
    container.className = 'kit-ripple-container'
    el.appendChild(container)

    // Сохраняем ссылку на контейнер для использования в обработчике
    el._rippleContainer = container

    el.addEventListener('mousedown', createRipple)
  },
  unmounted(el) {
    el.removeEventListener('mousedown', createRipple)
    if (el._rippleContainer) {
      el._rippleContainer.remove()
      delete el._rippleContainer
    }
  },
}

function createRipple(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement
  const container = (el as any)._rippleContainer

  if (!container)
    return

  const circle = document.createElement('span')
  const diameter = Math.max(el.clientWidth, el.clientHeight)
  const radius = diameter / 2

  // Вычисляем позицию клика относительно элемента
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  circle.style.width = circle.style.height = `${diameter}px`
  circle.style.left = `${x - radius}px`
  circle.style.top = `${y - radius}px`
  circle.classList.add('kit-ripple-element')

  container.appendChild(circle)

  // Удаляем элемент после завершения анимации (0.6s = 600ms)
  setTimeout(() => {
    circle.remove()
  }, 600)
}

export { vRipple }
