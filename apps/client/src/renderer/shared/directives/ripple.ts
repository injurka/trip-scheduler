import type { Directive } from 'vue'

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

if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.innerHTML = rippleStyle
  document.head.appendChild(style)
}

const vRipple: Directive = {
  mounted(el) {
    const computedStyle = window.getComputedStyle(el)
    if (computedStyle.position === 'static') {
      el.style.position = 'relative'
    }

    const container = document.createElement('div')
    container.className = 'kit-ripple-container'
    el.appendChild(container)

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

  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  circle.style.width = circle.style.height = `${diameter}px`
  circle.style.left = `${x - radius}px`
  circle.style.top = `${y - radius}px`
  circle.classList.add('kit-ripple-element')

  container.appendChild(circle)

  setTimeout(() => {
    circle.remove()
  }, 600)
}

export { vRipple }
