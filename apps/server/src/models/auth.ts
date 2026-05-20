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