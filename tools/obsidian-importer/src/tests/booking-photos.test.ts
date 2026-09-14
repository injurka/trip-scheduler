import type { Booking } from '../types'
import { describe, expect, it } from 'bun:test'
import { resolveAndUploadBookingPhotos } from '../lib/booking-media'

describe('resolveAndUploadBookingPhotos', () => {
  it('keeps direct HTTP URLs without calling uploader', async () => {
    const bookings: Booking[] = [
      {
        id: 'b1',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Grand Hotel',
        data: {
          hotelName: 'Grand Hotel',
          photos: ['https://example.com/hotel1.jpg', 'https://example.com/hotel2.jpg'],
        },
      },
    ]

    const imageIndex = new Map<string, string>()
    const uploadCache = new Map<string, string>()
    let uploadCalled = false

    const uploader = {
      uploadImage: async () => {
        uploadCalled = true
        return 'https://server.com/img.jpg'
      },
    }

    const result = await resolveAndUploadBookingPhotos(
      bookings,
      imageIndex,
      uploader,
      'trip-123',
      uploadCache,
      { uploadImages: true },
    )

    expect(uploadCalled).toBe(false)
    expect(result.totalUploaded).toBe(0)
    expect(bookings[0].data.photos).toEqual([
      'https://example.com/hotel1.jpg',
      'https://example.com/hotel2.jpg',
    ])
  })

  it('uploads local files resolved from imageIndex and caches the result', async () => {
    const tmpFile = import.meta.filename // existing local file
    const bookings: Booking[] = [
      {
        id: 'b1',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Grand Hotel',
        data: {
          hotelName: 'Grand Hotel',
          photos: ['my_hotel.jpg'],
        },
      },
      {
        id: 'b2',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Grand Hotel 2nd stay',
        data: {
          hotelName: 'Grand Hotel',
          photos: ['my_hotel.jpg'], // same file in second booking
        },
      },
    ]

    const imageIndex = new Map<string, string>()
    imageIndex.set('my_hotel.jpg', tmpFile)

    const uploadCache = new Map<string, string>()
    let uploadCount = 0

    const uploader = {
      uploadImage: async (_tripId: string, filePath: string) => {
        uploadCount++
        return `https://server.com/uploaded/${filePath.split('/').at(-1)}`
      },
    }

    const result = await resolveAndUploadBookingPhotos(
      bookings,
      imageIndex,
      uploader,
      'trip-123',
      uploadCache,
      { uploadImages: true },
    )

    // Should only call uploadImage once due to caching
    expect(uploadCount).toBe(1)
    expect(result.totalUploaded).toBe(1)
    expect(result.bookingsUpdated).toBe(2)
    expect(bookings[0].data.photos).toEqual([`https://server.com/uploaded/${tmpFile.split('/').at(-1)}`])
    expect(bookings[1].data.photos).toEqual([`https://server.com/uploaded/${tmpFile.split('/').at(-1)}`])
    expect(uploadCache.get(tmpFile)).toBe(`https://server.com/uploaded/${tmpFile.split('/').at(-1)}`)
  })

  it('preserves file names when uploadImages is false', async () => {
    const tmpFile = import.meta.filename
    const bookings: Booking[] = [
      {
        id: 'b1',
        type: 'hotel',
        icon: 'mdi:hotel',
        title: 'Grand Hotel',
        data: {
          hotelName: 'Grand Hotel',
          photos: ['my_hotel.jpg'],
        },
      },
    ]

    const imageIndex = new Map<string, string>()
    imageIndex.set('my_hotel.jpg', tmpFile)

    const uploadCache = new Map<string, string>()
    const result = await resolveAndUploadBookingPhotos(
      bookings,
      imageIndex,
      null,
      'trip-123',
      uploadCache,
      { uploadImages: false },
    )

    expect(result.totalUploaded).toBe(0)
    expect(bookings[0].data.photos).toEqual(['my_hotel.jpg'])
  })
})
