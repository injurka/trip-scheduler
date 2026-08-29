export type CategoryId
  = | 'maps'
    | 'payment'
    | 'transport'
    | 'hotels'
    | 'flights'
    | 'activities'
    | 'connectivity'
    | 'food'
    | 'info'

export interface CategoryInfo {
  id: CategoryId
  title: string
  icon: string
  description?: string
}

export type CountryTipType = 'warning' | 'info' | 'tip'

export interface CountryTip {
  title: string
  text: string
  icon?: string
  type?: CountryTipType
}

export interface CountryInfo {
  id: string
  name: string
  flag: string
  code?: string
  popular?: boolean
  description?: string
  tips?: CountryTip[]
}

export interface ServiceLinkBlocked {
  countryId: string
  reason: string
}

export interface ServiceLink {
  id: string
  name: string
  url: string
  description: string
  categories: CategoryId[]
  countries: string[] // countryIds or ['global']
  popularIn?: string[] // countryIds where this is the top / #1 choice
  blockedIn?: ServiceLinkBlocked[] // countries where this service is blocked / does not work
  countryNotes?: Record<string, string> // countryId -> specific local tip
  recommended?: boolean
  tags?: string[]
  appStoreUrl?: string
  googlePlayUrl?: string
  isGlobal?: boolean
}

export interface LinkCategoryDisplay {
  id: CategoryId
  title: string
  icon: string
  links: ServiceLink[]
}
