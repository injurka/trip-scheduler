export interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  coverImage: string | null
  publishedAt: string | null // ISO Date string
  createdAt: string // ISO Date string
  updatedAt: string // ISO Date string
}

export type BlogListItems = Omit<BlogPost, 'content'>

export interface CreateBlogPostInput {
  title: string
  slug: string
  content: string
  excerpt?: string
  coverImage?: string
  published?: boolean
}

export interface UpdateBlogPostInput {
  id: string
  data: Partial<CreateBlogPostInput>
}
