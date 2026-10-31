import { describe, expect, it } from 'bun:test'
import { useDialogFullscreen } from '../src/renderer/components/01.kit/kit-dialog-with-close/composables/use-dialog-fullscreen'

describe('useDialogFullscreen', () => {
  it('initializes with default value (false)', () => {
    const { isFullscreen } = useDialogFullscreen()
    expect(isFullscreen.value).toBe(false)
  })

  it('initializes with custom initial value', () => {
    const { isFullscreen } = useDialogFullscreen({ initial: true })
    expect(isFullscreen.value).toBe(true)
  })

  it('toggles fullscreen state correctly', () => {
    const { isFullscreen, toggleFullscreen } = useDialogFullscreen()
    expect(isFullscreen.value).toBe(false)

    toggleFullscreen()
    expect(isFullscreen.value).toBe(true)

    toggleFullscreen()
    expect(isFullscreen.value).toBe(false)
  })

  it('enters and exits fullscreen explicitly', () => {
    const { isFullscreen, enterFullscreen, exitFullscreen } = useDialogFullscreen()

    enterFullscreen()
    expect(isFullscreen.value).toBe(true)

    // idempotent
    enterFullscreen()
    expect(isFullscreen.value).toBe(true)

    exitFullscreen()
    expect(isFullscreen.value).toBe(false)

    exitFullscreen()
    expect(isFullscreen.value).toBe(false)
  })
})
