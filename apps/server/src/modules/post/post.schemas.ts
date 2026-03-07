import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { postElements, postMedia, posts } from '~/../db/schema'
import { UserSchema } from '../user/user.schemas'

const PostContentBlockBaseSchema = z.object({
  id: z.string(),
})

const PostContentBlockTextSchema = PostContentBlockBaseSchema.extend({
  type: z.literal('markdown'),
  text: z.string(),
})

const PostContentBlockImageSchema = PostContentBlockBaseSchema.extend({
  type: z.literal('image'),
  imageId: z.string().uuid(),
  caption: z.string().optional(),
  viewMode: z.enum(['default', 'full-width']).optional(),
})

const PostContentBlockGallerySchema = PostContentBlockBaseSchema.extend({
  type: z.literal('gallery'),
  imageIds: z.array(z.string().uuid()),
  displayType: z.enum(['grid', 'carousel']),
})

const MapPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
  address: z.string().optional(),
  color: z.string().optional(),
})

const PostContentBlockLocationSchema = PostContentBlockBaseSchema.extend({
  type: z.literal('location'),
  location: MapPointSchema,
})

const MapRouteSchema = z.object({
  points: z.array(MapPointSchema),
  color: z.string().optional(),
  title: z.string().optional(),
})

const PostContentBlockRouteSchema = PostContentBlockBaseSchema.extend({
  type: z.literal('route'),
  route: MapRouteSchema,
})

export const PostElementContentSchema = z.discriminatedUnion('type', [
  PostContentBlockTextSchema,
  PostContentBlockImageSchema,
  PostContentBlockGallerySchema,
  PostContentBlockLocationSchema,
  PostContentBlockRouteSchema,
])

export const PostStatsDetailSchema = z.object({
  views: z.number().default(0),
  budget: z.string().default(''),
  duration: z.string().default(''),
})

export const PostMediaSchema = createSelectSchema(postMedia)
export const PostElementSchema = createSelectSchema(postElements).extend({
  content: z.array(PostElementContentSchema),
})

const BasePostSchema = createSelectSchema(posts).extend({
  statsDetail: PostStatsDetailSchema,
})

export const PostSchema = BasePostSchema
  .omit({ likesCount: true, savesCount: true })
  .extend({
    user: UserSchema.pick({ id: true, name: true, avatarUrl: true }),
    elements: z.array(PostElementSchema).optional(),
    media: z.array(PostMediaSchema).optional(),
    stats: z.object({
      likes: z.number(),
      saves: z.number(),
      isLiked: z.boolean(),
      isSaved: z.boolean(),
    }),
  })

export const CreatePostElementInput = z.object({
  title: z.string().optional(),
  content: z.array(PostElementContentSchema),
})

export const CreatePostInputSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен'),
  insight: z.string().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'completed', 'planned']).default('draft'),
  elements: z.array(CreatePostElementInput).optional(),
  mediaIds: z.array(z.string().uuid()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  statsDetail: PostStatsDetailSchema.partial().optional(),
})

export const UpdatePostInputSchema = z.object({
  id: z.string().uuid(),
  data: CreatePostInputSchema.partial(),
})

export const GetPostByIdInputSchema = z.object({
  id: z.string().uuid(),
})

export const ListPostsInputSchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  cursor: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  tag: z.string().optional(),
  country: z.string().optional(),
  query: z.string().optional(),
  onlySaved: z.boolean().optional(),
})

export const ToggleSavePostInputSchema = z.object({
  postId: z.string().uuid(),
})

export const ToggleLikePostInputSchema = z.object({
  postId: z.string().uuid(),
})
