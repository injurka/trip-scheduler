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

export interface TelegramAuthPayload {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}
