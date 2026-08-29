import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { db } from 'db'
import { postMedia, tripImages } from 'db/schema'
import { eq } from 'drizzle-orm'
import { s3Service } from './s3.service'

const execFileAsync = promisify(execFile)

export interface VideoMetadata {
  width?: number
  height?: number
  duration?: number
  codec?: string
  bitrate?: number
  fps?: number
  rotation?: number
}

class VideoProcessingService {
  /**
   * Извлекает технические метаданные видеофайла с помощью ffprobe
   */
  async probeVideo(filePath: string): Promise<VideoMetadata> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=width,height,codec_name,r_frame_rate,duration,bit_rate:stream_tags=rotate:format=duration,bit_rate',
        '-of',
        'json',
        filePath,
      ])

      const data = JSON.parse(stdout)
      const videoStream = data.streams?.find((s: any) => s.width && s.height) || data.streams?.[0] || {}
      const format = data.format || {}

      let duration = Number.parseFloat(videoStream.duration || format.duration || '0')
      if (Number.isNaN(duration))
        duration = 0

      const width = videoStream.width ? Number.parseInt(videoStream.width, 10) : undefined
      const height = videoStream.height ? Number.parseInt(videoStream.height, 10) : undefined
      const codec = videoStream.codec_name || undefined
      const bitrate = format.bit_rate ? Number.parseInt(format.bit_rate, 10) : undefined
      const rotation = videoStream.tags?.rotate ? Number.parseInt(videoStream.tags.rotate, 10) : 0

      return {
        width,
        height,
        duration,
        codec,
        bitrate,
        rotation,
      }
    }
    catch (e) {
      console.error('[VideoProcessing] FFprobe error:', e)
      return {}
    }
  }

  /**
   * Генерирует WebP постер из кадра видео
   */
  async generatePoster(inputPath: string, outputPath: string): Promise<void> {
    // Делаем снимок на 1-й секунде (или 0, если видео короче 1 сек)
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      '00:00:01',
      '-i',
      inputPath,
      '-vframes',
      '1',
      '-vf',
      'scale=\'min(1280,iw)\':-2',
      '-c:v',
      'libwebp',
      '-quality',
      '85',
      outputPath,
    ])
  }

  /**
   * Сжимает и оптимизирует видео в веб-формат MP4 (H.264 + AAC) с флагом +faststart
   */
  async transcodeWebOptimized(inputPath: string, outputPath: string): Promise<void> {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=\'min(1920,iw)\':-2', // Максимум 1080p, сохраняя пропорции
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23', // Оптимальный баланс качества и размера
      '-maxrate',
      '5M',
      '-bufsize',
      '10M',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart', // moov atom переносится в начало для мгновенного старта
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      outputPath,
    ])
  }

  /**
   * Запускает фоновую обработку видео (скачивание из S3 во временную директорию,
   * генерация постера и web-версии, загрузка обратно в S3 и обновление записи в БД).
   */
  async processVideoBackground(imageId: string, s3Key: string): Promise<void> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trip-video-'))
    const ext = path.extname(s3Key) || '.mp4'
    const inputPath = path.join(tmpDir, `original${ext}`)
    const posterPath = path.join(tmpDir, 'poster.webp')
    const webVideoPath = path.join(tmpDir, 'web.mp4')

    try {
      // 1. Скачиваем оригинальное видео во временный файл потоком
      const streamRes = await s3Service.getObjectStream(s3Key)
      if (!streamRes || !streamRes.stream) {
        throw new Error(`Не удалось получить поток для ${s3Key}`)
      }

      // Записываем Web/Node stream во временный файл
      const fileHandle = await fs.open(inputPath, 'w')
      const writeStream = fileHandle.createWriteStream()

      if (typeof streamRes.stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of streamRes.stream) {
          writeStream.write(chunk)
        }
      }
      else {
        // Web ReadableStream
        const reader = streamRes.stream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break
          writeStream.write(value)
        }
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err?: Error | null) => {
          if (err)
            reject(err)
          else resolve()
        })
      })

      // 2. Читаем метаданные
      const meta = await this.probeVideo(inputPath)

      // 3. Генерируем постер
      let posterS3Key: string | undefined
      try {
        await this.generatePoster(inputPath, posterPath)
        const posterBuffer = await fs.readFile(posterPath)
        const dirName = path.dirname(s3Key)
        const baseName = path.basename(s3Key, ext)
        posterS3Key = `${dirName}/${baseName}-poster.webp`
        await s3Service.uploadFile(posterS3Key, posterBuffer, 'image/webp')
      }
      catch (posterErr) {
        console.warn(`[VideoProcessing] Ошибка генерации постера:`, posterErr)
      }

      // 4. Генерируем web-оптимизированное видео
      let webVideoS3Key: string | undefined
      try {
        await this.transcodeWebOptimized(inputPath, webVideoPath)
        const dirName = path.dirname(s3Key)
        const baseName = path.basename(s3Key, ext)
        webVideoS3Key = `${dirName}/${baseName}-web.mp4`

        const webBuffer = await fs.readFile(webVideoPath)
        await s3Service.uploadFile(webVideoS3Key, webBuffer, 'video/mp4')
      }
      catch (transcodeErr) {
        console.warn(`[VideoProcessing] Ошибка перекодирования web видео:`, transcodeErr)
      }

      // 5. Обновляем запись в БД
      const existingTripImage = await db.query.tripImages.findFirst({
        where: eq(tripImages.id, imageId),
      })

      if (existingTripImage) {
        const currentVariants = (existingTripImage.variants as Record<string, string>) || {}
        const currentMeta = (existingTripImage.metadata as Record<string, any>) || {}

        const newVariants: Record<string, string> = {
          ...currentVariants,
          ...(posterS3Key ? { poster: posterS3Key, small: posterS3Key, medium: posterS3Key } : {}),
          ...(webVideoS3Key ? { web: webVideoS3Key, large: webVideoS3Key } : {}),
        }

        const newMeta = {
          ...currentMeta,
          duration: meta.duration,
          codec: meta.codec,
          bitrate: meta.bitrate,
          processed: true,
        }

        await db.update(tripImages)
          .set({
            width: meta.width || existingTripImage.width,
            height: meta.height || existingTripImage.height,
            variants: newVariants,
            metadata: newMeta,
          })
          .where(eq(tripImages.id, imageId))
      }
      else {
        const existingPostMedia = await db.query.postMedia.findFirst({
          where: eq(postMedia.id, imageId),
        })

        if (existingPostMedia) {
          const currentVariants = (existingPostMedia.variants as Record<string, string>) || {}
          const currentMeta = (existingPostMedia.metadata as Record<string, any>) || {}

          const newVariants: Record<string, string> = {
            ...currentVariants,
            ...(posterS3Key ? { poster: posterS3Key, small: posterS3Key, medium: posterS3Key } : {}),
            ...(webVideoS3Key ? { web: webVideoS3Key, large: webVideoS3Key } : {}),
          }

          const newMeta = {
            ...currentMeta,
            duration: meta.duration,
            codec: meta.codec,
            bitrate: meta.bitrate,
            processed: true,
          }

          await db.update(postMedia)
            .set({
              width: meta.width || existingPostMedia.width,
              height: meta.height || existingPostMedia.height,
              variants: newVariants,
              metadata: newMeta,
            })
            .where(eq(postMedia.id, imageId))
        }
      }
    }
    catch (err) {
      console.error(`[VideoProcessing] Ошибка фоновой обработки видео imageId=${imageId}:`, err)
    }
    finally {
      // Удаляем временную папку
      try {
        await fs.rm(tmpDir, { recursive: true, force: true })
      }
      catch { }
    }
  }
}

export const videoProcessingService = new VideoProcessingService()
