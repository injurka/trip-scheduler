export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture: string
}

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
  email: string | null
}

export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

export interface YandexUser {
  id: string | number
  login?: string
  client_id?: string
  display_name?: string
  real_name?: string
  first_name?: string
  last_name?: string
  sex?: string | null
  default_email?: string
  emails?: string[]
  default_avatar_id?: string
  is_avatar_empty?: boolean
}
