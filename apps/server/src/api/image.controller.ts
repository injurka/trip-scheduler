import { existsSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'

const imageController = new Hono()

const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif']

imageController.get('/*', async (c) => {
  const filePath = c.req.path.replace(/^\/static\//, '')
  const staticRoot = process.env.STATIC_PATH || 'static'

  const fullPath = resolve(process.cwd(), staticRoot, filePath)
  if (!fullPath.startsWith(resolve(process.cwd(), staticRoot))) {
    throw new HTTPException(403, { message: 'Access denied' })
  }

  if (!existsSync(fullPath)) {
    return c.notFound()
  }

  const width = c.req.query('w') ? Number.parseInt(c.req.query('w')!) : undefined
  const height = c.req.query('h') ? Number.parseInt(c.req.query('h')!) : undefined
  const quality = c.req.query('q') ? Number.parseInt(c.req.query('q')!) : 80
  const format = c.req.query('fmt') || null

  if (!width && !height && !format) {
    const file = Bun.file(fullPath)
    return c.body(file.stream(), 200, {
      'Content-Type': file.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  }

  try {
    const fileBuffer = await Bun.file(fullPath).arrayBuffer()

    let pipeline = sharp(fileBuffer, { animated: true })

    if (width || height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit: 'cover',
        withoutEnlargement: true,
      })
    }

    const fileExt = extname(fullPath).slice(1).toLowerCase()
    const targetFormat = (format && ALLOWED_FORMATS.includes(format)) ? format : fileExt

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

    return c.body(new Uint8Array(processedBuffer), 200, {
      'Content-Type': `image/${targetFormat}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  }
  catch (error) {
    console.error('Image processing error:', error)
    throw new HTTPException(500, { message: 'Image processing failed' })
  }
})

export { imageController }
