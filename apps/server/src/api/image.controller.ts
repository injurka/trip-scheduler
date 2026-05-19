import { extname } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { db } from '~/../db'
import { tripImages, tripParticipants, trips } from '~/../db/schema'
import { authUtils } from '~/lib/auth.utils'
import {
  imageOutputSizeBytesHistogram,
  imageProcessingDurationHistogram,
} from '~/services/metrics.service'
import { s3Service } from '~/services/s3.service'

const imageController = new Hono()

const ALLOWED_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif']

imageController.get('/*', async (c) => {
  const endTimer = imageProcessingDurationHistogram.startTimer()
  const filePath = c.req.path.replace(/^\/+/, '').replace(/^image\//, '')

  if (filePath.includes('/documents/')) {
    const imageRecord = await db.query.tripImages.findFirst({ where: eq(tripImages.url, filePath) })
    if (imageRecord && (imageRecord.metadata as any)?.access === 'private') {
      const token = c.req.query('token') || c.req.header('authorization')?.split(' ')[1]
      const user = await authUtils.getUserFromToken(token)

      if (!user)
        throw new HTTPException(401, { message: 'Unauthorized' })

      const isAdmin = user.role === 'admin'
      const participant = await db.query.tripParticipants.findFirst({
        where: and(eq(tripParticipants.tripId, imageRecord.tripId), eq(tripParticipants.userId, user.id)),
      })

      const trip = await db.query.trips.findFirst({ where: eq(trips.id, imageRecord.tripId) })
      const isOwner = trip?.userId === user.id

      if (!participant && !isOwner && !isAdmin)
        throw new HTTPException(403, { message: 'Forbidden' })
    }
  }

  const width = c.req.query('w') ? Number.parseInt(c.req.query('w')!) : undefined
  const height = c.req.query('h') ? Number.parseInt(c.req.query('h')!) : undefined
  const quality = c.req.query('q') ? Number.parseInt(c.req.query('q')!) : 80
  const format = c.req.query('fmt') || null

  const fileExt = extname(filePath).slice(1).toLowerCase()
  const targetFormat = (format && ALLOWED_IMAGE_FORMATS.includes(format)) ? format : fileExt

  const s3Result = await s3Service.getFile(filePath)

  if (!s3Result) {
    endTimer({ status: 'error', format: 'unknown', type: 'not_found' })
    return c.notFound()
  }

  const isProcessableImage = ALLOWED_IMAGE_FORMATS.includes(fileExt) || s3Result.contentType.startsWith('image/')

  if (!isProcessableImage) {
    endTimer({ status: 'success', format: fileExt || 'doc', type: 'skipped' })
    imageOutputSizeBytesHistogram.observe({ format: fileExt || 'doc', type: 'skipped' }, s3Result.buffer.byteLength)

    const disposition = (fileExt === 'pdf' || fileExt === 'txt') ? 'inline' : 'attachment'

    return c.body(s3Result.buffer as any, 200, {
      'Content-Type': s3Result.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `${disposition}; filename="document.${fileExt || 'bin'}"`,
    })
  }

  if (!width && !height && !format) {
    endTimer({ status: 'success', format: fileExt, type: 'skipped' })
    imageOutputSizeBytesHistogram.observe({ format: fileExt, type: 'skipped' }, s3Result.buffer.byteLength)
    return c.body(s3Result.buffer as any, 200, {
      'Content-Type': s3Result.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  }

  try {
    let pipeline = sharp(s3Result.buffer, { animated: true })

    if (width || height) {
      pipeline = pipeline.resize({ width, height, fit: 'cover', withoutEnlargement: true })
    }

    if (targetFormat === 'webp')
      pipeline = pipeline.webp({ quality, effort: 4, smartSubsample: true })
    else if (targetFormat === 'avif')
      pipeline = pipeline.avif({ quality, effort: 3 })
    else if (targetFormat === 'jpeg' || targetFormat === 'jpg')
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
    else if (targetFormat === 'png')
      pipeline = pipeline.png({ quality, compressionLevel: 8 })
    else if (targetFormat === 'gif')
      pipeline = pipeline.gif({ effort: 7, reuse: true })

    const processedBuffer = await pipeline.toBuffer()

    endTimer({ status: 'success', format: targetFormat, type: 'processed' })
    imageOutputSizeBytesHistogram.observe({ format: targetFormat, type: 'processed' }, processedBuffer.length)

    return c.body(new Uint8Array(processedBuffer), 200, {
      'Content-Type': `image/${targetFormat}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  }
  catch (error) {
    console.error('Image processing error:', error)
    endTimer({ status: 'error', format: targetFormat, type: 'processed' })
    throw new HTTPException(500, { message: 'Image processing failed' })
  }
})

export { imageController }
