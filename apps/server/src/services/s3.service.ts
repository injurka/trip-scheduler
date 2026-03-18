import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
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
