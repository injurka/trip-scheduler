import { describe, expect, it, mock } from 'bun:test'
import { strFromU8, unzipSync } from 'fflate'
import { exportToMapsMe } from '../src/renderer/components/04.features/trip-info/trip-overview/lib/mapsme-export'

const dummyTrip = {
  id: 'trip-123',
  title: 'Поездка в Токио',
  startDate: '2026-05-01',
  endDate: '2026-05-10',
  description: '',
  descriptionShort: '',
  status: 'planned' as const,
  visibility: 'private' as const,
}

const dummyPoints = [
  {
    id: 'pt-1',
    title: 'Отель Синдзюку',
    coordinates: [139.7003, 35.6895],
    type: 'start',
    activityTag: 'relax',
  },
  {
    id: 'pt-2',
    title: 'Раменная',
    coordinates: [139.7020, 35.6900],
    type: 'waypoint',
    activityTag: 'food',
  },
]

const dummyRoutes = [
  {
    id: 'r-1',
    title: 'Прогулка до раменной',
    color: '#ff5500',
    geometry: [
      [139.7003, 35.6895],
      [139.7010, 35.6898],
      [139.7020, 35.6900],
    ],
  },
]

function verifyKmlContent(kmlText: string) {
  expect(kmlText).toContain('<kml')
  expect(kmlText).toContain('Поездка в Токио')
  expect(kmlText).toContain('Отель Синдзюку')
  expect(kmlText).toContain('Раменная')
  expect(kmlText).toContain('Прогулка до раменной')
  expect(kmlText).toContain('http://maps.me/placemarks/')
}

async function verifyBlobKmz(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  const unzipped = unzipSync(new Uint8Array(buffer))
  expect(unzipped['trip-123.kml']).toBeDefined()
  verifyKmlContent(strFromU8(unzipped['trip-123.kml']))
}

function decodeBase64ToBytes(base64Str: string): Uint8Array {
  const binaryString = atob(base64Str)
  const bytes = new Uint8Array(binaryString.length)

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

function mockBrowserDom() {
  let clickedDownloadName = ''
  let createdBlob: Blob | null = null

  const origCreateElement = globalThis.document?.createElement
  const origCreateObjectURL = globalThis.URL?.createObjectURL
  const origRevokeObjectURL = globalThis.URL?.revokeObjectURL
  const origBody = globalThis.document?.body

  globalThis.URL = globalThis.URL || {} as any
  globalThis.URL.createObjectURL = mock((blob: any) => {
    createdBlob = blob

    return 'blob:mock-url'
  })
  globalThis.URL.revokeObjectURL = mock(() => {})

  globalThis.document = globalThis.document || {} as any
  globalThis.document.body = {
    appendChild: mock(() => {}),
    removeChild: mock(() => {}),
  } as any

  globalThis.document.createElement = mock(() => ({
    click(this: any) {
      clickedDownloadName = this.download
    },
  })) as any

  const restore = () => {
    globalThis.document.createElement = origCreateElement!
    globalThis.URL.createObjectURL = origCreateObjectURL!
    globalThis.URL.revokeObjectURL = origRevokeObjectURL!
    globalThis.document.body = origBody!
  }

  return {
    restore,
    getClickedDownloadName: () => clickedDownloadName,
    getCreatedBlob: () => createdBlob,
  }
}

describe('mapsme-export', () => {
  it('exports KMZ in browser environment with correct sanitized filename and valid KML', async () => {
    const dom = mockBrowserDom()

    try {
      const result = await exportToMapsMe(dummyTrip as any, dummyPoints, dummyRoutes)

      expect(result).toBeDefined()
      expect(result!.success).toBe(true)
      expect(result!.fileName).toBe('Поездка в Токио.kmz')
      expect(dom.getClickedDownloadName()).toBe('Поездка в Токио.kmz')
      await verifyBlobKmz(dom.getCreatedBlob()!)
    }
    finally {
      dom.restore()
    }
  })

  it('calls Tauri export_and_open_in_mapsme command with valid base64 KMZ when in Tauri', async () => {
    let invokedCommand = ''
    let invokedPayload: any = null

    ;(globalThis as any).window = {
      __TAURI_INTERNALS__: {
        invoke: mock(async (cmd: string, args: any) => {
          invokedCommand = cmd
          invokedPayload = args

          return {
            fileName: args.fileName,
            status: 'opened_mapsme',
            message: 'Маршрут открыт в Maps.me и сохранён в Загрузки',
          }
        }),
      },
    }

    try {
      const result = await exportToMapsMe(dummyTrip as any, dummyPoints, dummyRoutes)

      expect(result).toBeDefined()
      expect(result!.success).toBe(true)
      expect(result!.status).toBe('opened_mapsme')
      expect(result!.message).toContain('Maps.me')
      expect(invokedCommand).toBe('export_and_open_in_mapsme')
      expect(invokedPayload.fileName).toBe('Поездка в Токио.kmz')
      expect(invokedPayload.base64Data).toBeDefined()

      const unzipped = unzipSync(decodeBase64ToBytes(invokedPayload.base64Data))
      expect(unzipped['trip-123.kml']).toBeDefined()
      expect(strFromU8(unzipped['trip-123.kml'])).toContain('Поездка в Токио')
    }
    finally {
      delete (globalThis as any).window
    }
  })
})
