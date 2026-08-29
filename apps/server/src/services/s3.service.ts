import { Readable } from 'node:stream'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'

class S3Service {
  private client: S3Client
  private bucket: string

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'trip-scheduler-bucket'
    this.client = new S3Client({
      region: process.env.S3_REGION || 'default',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
    })
  }

  async uploadFile(key: string, buffer: Uint8Array | Buffer, contentType?: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    )
  }

  async createMultipartUpload(key: string, contentType?: string): Promise<string> {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
      }),
    )

    if (!response.UploadId)
      throw new Error('Не удалось инициализировать составную загрузку S3')

    return response.UploadId
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array | Buffer,
  ): Promise<{ PartNumber: number, ETag: string }> {
    const response = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    )

    if (!response.ETag)
      throw new Error(`Не удалось загрузить часть #${partNumber}`)

    return {
      PartNumber: partNumber,
      ETag: response.ETag,
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number, ETag: string }[],
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      }),
    )
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      )
    }
    catch (e) {
      console.error(`S3 AbortMultipartUpload Error for key ${key}:`, e)
    }
  }

  async headObject(key: string): Promise<{ contentLength: number, contentType: string } | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
      return {
        contentLength: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
      }
    }
    catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  }

  async deleteFile(key: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    }
    catch (error) {
      console.error(`S3 Delete Error for key ${key}:`, error)
    }
  }

  async getFile(key: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )

      if (!response.Body)
        return null

      const byteArray = await response.Body.transformToByteArray()

      return {
        buffer: byteArray,
        contentType: response.ContentType || 'application/octet-stream',
      }
    }
    catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  }

  async getObjectStream(
    key: string,
    range?: string,
  ): Promise<{
    stream: any
    contentType: string
    contentLength?: number
    contentRange?: string
    status: 200 | 206
  } | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: range,
        }),
      )

      if (!response.Body)
        return null

      const isRange = !!range && (response.$metadata.httpStatusCode === 206 || !!response.ContentRange)

      // Преобразуем входящий поток в Web ReadableStream если это Node.js Readable
      let stream: any = response.Body
      if (response.Body instanceof Readable) {
        stream = Readable.toWeb(response.Body)
      }

      return {
        stream,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength,
        contentRange: response.ContentRange,
        status: isRange ? 206 : 200,
      }
    }
    catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  }

  async listDirectory(prefix: string) {
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
        }),
      )
      return response.Contents || []
    }
    catch (error) {
      console.error(`S3 List Error for prefix ${prefix}:`, error)
      return []
    }
  }

  async checkConnection(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({ Bucket: this.bucket }),
    )
  }

  async listDumpFolders(prefix: string): Promise<string[]> {
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
          Delimiter: '/',
        }),
      )
      return response.CommonPrefixes?.map(p => p.Prefix as string).filter(Boolean) || []
    }
    catch (error) {
      console.error(`S3 ListDumpFolders Error for prefix ${prefix}:`, error)
      return []
    }
  }

  async listFilesInFolder(prefix: string): Promise<string[]> {
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
        }),
      )
      return response.Contents?.map(item => item.Key as string).filter(Boolean) || []
    }
    catch (error) {
      console.error(`S3 ListFilesInFolder Error for prefix ${prefix}:`, error)
      return []
    }
  }

  async getFileContent(key: string): Promise<string> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
      if (!response.Body)
        return ''

      return await response.Body.transformToString('utf-8')
    }
    catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return ''
      }
      console.error(`S3 GetFileContent Error for key ${key}:`, error)
      throw error
    }
  }
}

export const s3Service = new S3Service()
