import { extname } from 'node:path'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import {
  imageOutputSizeBytesHistogram,
  imageProcessingDurationHistogram,
} from '~/services/metrics.service'
import { s3Service } from '~/services/s3.service'

const imageController = new Hono()

const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif']

imageController.get('/*', async (c) => {
  const endTimer = imageProcessingDurationHistogram.startTimer()

  const filePath = c.req.path.replace(/^\/+/, '').replace(/^image\//, '')

  const width = c.req.query('w') ? Number.parseInt(c.req.query('w')!) : undefined
  const height = c.req.query('h') ? Number.parseInt(c.req.query('h')!) : undefined
  const quality = c.req.query('q') ? Number.parseInt(c.req.query('q')!) : 80
  const format = c.req.query('fmt') || null

  const fileExt = extname(filePath).slice(1).toLowerCase()
  const targetFormat = (format && ALLOWED_FORMATS.includes(format)) ? format : fileExt

  const s3Result = await s3Service.getFile(filePath)

  if (!s3Result) {
    endTimer({ status: 'error', format: 'unknown', type: 'not_found' })
    return c.notFound()
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

    if (targetFormat === 'webp') {
      pipeline = pipeline.webp({ quality, effort: 4, smartSubsample: true })
    }
    else if (targetFormat === 'avif') {
      pipeline = pipeline.avif({ quality, effort: 3 })
    }
    else if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true })
    }
    else if (targetFormat === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 8 })
    }
    else if (targetFormat === 'gif') {
      pipeline = pipeline.gif({ effort: 7, reuse: true })
    }

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
