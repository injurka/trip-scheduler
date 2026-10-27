import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KitVideoPlayer from '../src/ui/kit-video-player.vue'

describe('video player controls', () => {
  it('synchronizes time, seeking, volume and playback speed with the media element', async () => {
    const wrapper = mount(KitVideoPlayer, { props: { src: '/clip.mp4', label: 'Видео' } })
    const media = wrapper.get('video').element
    Object.defineProperty(media, 'duration', { configurable: true, value: 120 })
    media.currentTime = 30
    await wrapper.get('video').trigger('loadedmetadata')
    expect(wrapper.get('.video-time').text()).toBe('0:30 / 2:00')
    await wrapper.get('input[aria-label="Позиция воспроизведения"]').setValue('60')
    expect(media.currentTime).toBe(60)
    await wrapper.get('input[aria-label="Громкость"]').setValue('0.5')
    expect(media.volume).toBe(0.5)
    await wrapper.get('button[aria-label="Выключить звук"]').trigger('click')
    expect(media.muted).toBe(true)
    await wrapper.get('select').setValue('1.5')
    expect(media.playbackRate).toBe(1.5)
    wrapper.unmount()
  })

  it('reports a rejected play request without an unhandled rejection', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'))
    const wrapper = mount(KitVideoPlayer, { props: { src: '/clip.mp4', label: 'Видео' } })
    await wrapper.get('.center-play').trigger('click')
    await Promise.resolve()
    expect(wrapper.get('[role="status"]').text()).toContain('Не удалось начать')
    wrapper.unmount()
    play.mockRestore()
  })
})
