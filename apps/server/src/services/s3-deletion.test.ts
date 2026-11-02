import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { s3Service } from './s3.service'

const send = spyOn(S3Client.prototype, 'send')
afterEach(() => {
  send.mockReset()
})
describe('S3 deletion acknowledgement', () => {
  it('propagates individual delete failures instead of reporting success', async () => {
    send.mockImplementation(async () => {
      throw new Error('AccessDenied')
    })
    await expect(s3Service.deleteFile('posts/post/file.jpg')).rejects.toThrow('AccessDenied')
  })
  it('detects per-object failures in a successful HTTP bulk response', async () => {
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof DeleteObjectsCommand)
        return { Errors: [{ Key: 'posts/post/file.jpg', Code: 'AccessDenied' }] }
      throw new Error('AccessDenied')
    })
    await expect(s3Service.deleteFiles(['posts/post/file.jpg'])).rejects.toThrow('AccessDenied')
  })
  it('supports providers without bulk deletion using successful individual deletes', async () => {
    const removed: string[] = []
    send.mockImplementation(async (command) => {
      if (command instanceof DeleteObjectsCommand)
        throw new Error('NotImplemented')
      if (command instanceof DeleteObjectCommand)
        removed.push(command.input.Key || '')
      return {}
    })
    await s3Service.deleteFiles(['a', 'b'])
    expect(removed).toEqual(['a', 'b'])
  })
  it('preserves cleanup failure when deleting a whole post folder', async () => {
    send.mockImplementation(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        expect(command.input.Prefix).toBe('posts/post/')
        return { Contents: [{ Key: 'posts/post/file.jpg' }] }
      }
      throw new Error('Unavailable')
    })
    await expect(s3Service.deleteFolder('posts/post')).rejects.toThrow('Unavailable')
  })
})
