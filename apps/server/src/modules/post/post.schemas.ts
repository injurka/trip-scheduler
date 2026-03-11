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
  displayType: z.enum(['grid', 'panorama', 'masonry', 'slider']).default('grid'),
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
  duration: z.number().default(0),
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
  day: z.number().default(1),
  time: z.string().optional().nullable(),
  content: z.array(PostElementContentSchema),
})

export const CreatePostInputSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен'),
  insight: z.string().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  startDate: z.string().optional().nullable(),
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

export const GeneratePostInputSchema = z.object({
  text: z.string().min(10, 'Опишите ваше путешествие подробнее (минимум 10 символов)'),
})

export const AiGeneratedBlockSchema = z.object({
  type: z.enum(['text', 'location', 'route']),
  content: z.string().nullish(),
  name: z.string().nullish(),
  address: z.string().nullish(),
  coords: z.object({ lat: z.number(), lng: z.number() }).nullish(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  transport: z.enum(['walk', 'transit', 'car']).nullish(),
  distance: z.string().nullish(),
  duration: z.string().nullish(),
})

export const AiGeneratedStageSchema = z.object({
  title: z.string().nullish(),
  day: z.number().nullish(),
  time: z.string().nullish(),
  blocks: z.array(AiGeneratedBlockSchema).nullish(),
})

export const AiGeneratedPostOutputSchema = z.object({
  title: z.string().nullish(),
  insight: z.string().nullish(),
  description: z.string().nullish(),
  country: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  stages: z.array(AiGeneratedStageSchema).nullish(),
})
