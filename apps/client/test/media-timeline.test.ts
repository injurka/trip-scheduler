import { describe, expect, it } from 'bun:test'
import { groupTimelineMedia, readStoredTimelineMedia, readTimelineMedia, videoCreationDate } from '../src/renderer/components/05.modules/post/lib/media-timeline'

const item = (capturedAt: string, extra = {}) => ({ file: new File([''], 'photo.jpg'), capturedAt, source: 'exif' as const, ...extra })

describe('media timeline chronology', () => {
  it('sorts mixed selections, splits days and pauses, and retains every file once', () => {
    const files = [item('2026-11-05T08:00:00'), item('2026-11-04T11:30:00'), item(''), item('2026-11-04T08:00:00'), item('2026-11-04T08:15:00')]
    const groups = groupTimelineMedia(files)
    expect(groups.map(g => g.items.length)).toEqual([2, 1, 1, 1])
    expect(groups.map(g => g.date)).toEqual(['2026-11-04', '2026-11-04', '2026-11-05', ''])
    expect(new Set(groups.flatMap(g => g.items))).toEqual(new Set(files))
  })
  it('breaks continuous shooting into activities and honors adjustable gaps', () => {
    const files = [0, 1, 2, 3, 4].map(hour => item(`2026-11-04T${String(hour + 8).padStart(2, '0')}:00:00`))
    expect(groupTimelineMedia(files, 60).map(g => g.items.length)).toEqual([4, 1])
    expect(groupTimelineMedia(files, 30)).toHaveLength(5)
  })
  it('splits nearby times at distant GPS points, including zero coordinates', () => {
    expect(groupTimelineMedia([item('2026-11-04T08:00:00', { latitude: 0, longitude: 0 }), item('2026-11-04T08:01:00', { latitude: 0, longitude: 1 })])).toHaveLength(2)
  })
  it('uses camera filenames but never mistakes file modification time for capture time', async () => {
    const camera = await readTimelineMedia(new File([''], 'VID_20261104_123045.mp4', { lastModified: Date.now() }))
    expect(camera).toMatchObject({ capturedAt: '2026-11-04T12:30:45', source: 'filename' })
    const unknown = await readTimelineMedia(new File([''], 'download.jpg', { lastModified: Date.now() }))
    expect(unknown).toMatchObject({ capturedAt: '', source: 'unknown' })
    const invalid = await readTimelineMedia(new File([''], 'IMG_20260230_123045.jpg'))
    expect(invalid.source).toBe('unknown')
  })
})

function movie(version: number) {
  const bytes = new Uint8Array(48)
  const data = new DataView(bytes.buffer)
  data.setUint32(0, 48)
  bytes.set(new TextEncoder().encode('moov'), 4)
  data.setUint32(8, 40)
  bytes.set(new TextEncoder().encode('mvhd'), 12)
  data.setUint8(16, version)
  const seconds = Date.parse('2026-11-04T10:30:00Z') / 1000 + 2082844800
  if (version === 1)
    data.setBigUint64(20, BigInt(seconds))
  else
    data.setUint32(20, seconds)
  return new Blob([bytes])
}
describe('video capture metadata', () => {
  it('reads QuickTime mvhd versions 0 and 1', async () => {
    for (const version of [0, 1])
      expect((await videoCreationDate(movie(version)))?.toISOString()).toBe('2026-11-04T10:30:00.000Z')
  })
  it('returns no date for truncated or malformed boxes', async () => {
    expect(await videoCreationDate(new Blob([new Uint8Array(5)]))).toBeUndefined()
    const malformed = new Uint8Array(8)
    new DataView(malformed.buffer).setUint32(0, 1)
    expect(await videoCreationDate(new Blob([malformed]))).toBeUndefined()
  })
})

describe('persisted media grouping', () => {
  it('groups existing library items without fetching or uploading originals', () => {
    const media = [
      { id: 'a', type: 'image' as const, url: 'photo.jpg', metadata: { metadata: { capturedAt: '2026-11-04T09:00:00' } } },
      { id: 'b', type: 'video' as const, url: 'movie.mp4', metadata: { capturedAt: '2026-11-04T09:10:00' } },
      { id: 'c', type: 'image' as const, url: 'late.jpg', originalName: 'IMG_20261104_120000.jpg' },
    ]
    const groups = groupTimelineMedia(media.map(readStoredTimelineMedia))
    expect(groups.map(group => group.items.map(item => item.media?.id))).toEqual([['a', 'b'], ['c']])
    expect(groups.flatMap(group => group.items).every(item => !item.file)).toBe(true)
  })
})
