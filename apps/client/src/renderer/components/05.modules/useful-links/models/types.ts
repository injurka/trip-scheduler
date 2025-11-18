export interface Link {
  name: string
  url: string
  description: string
  tags?: string[]
  recommended?: boolean
}

export interface LinkCategory {
  title: string
  icon: string
  links: Link[]
}
