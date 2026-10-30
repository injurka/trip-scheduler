import type { CategoryId, CountryInfo, LinkCategoryDisplay, ServiceLink, ServiceLinkBlocked } from '../models/types'
import { COUNTRIES_DATA, LINK_CATEGORIES, SERVICE_LINKS } from '../lib/data'

function matchesLinkSearch(link: ServiceLink, query: string): boolean {
  const matchName = link.name.toLowerCase().includes(query)
  const matchDesc = link.description.toLowerCase().includes(query)
  const matchTags = link.tags?.some(tag => tag.toLowerCase().includes(query))
  const matchCountryNote = link.countryNotes && Object.values(link.countryNotes).some(note => note.toLowerCase().includes(query))

  return Boolean(matchName || matchDesc || matchTags || matchCountryNote)
}

function getServiceSortRank(link: ServiceLink, countryId: string) {
  return {
    popular: isServicePopular(link, countryId) ? 1 : 0,
    blocked: isServiceBlockedIn(link, countryId) ? 1 : 0,
    recommended: link.recommended ? 1 : 0,
  }
}

function isServicePopular(link: ServiceLink, countryId: string): boolean {
  return Boolean(link.popularIn?.includes(countryId))
}

function isServiceBlockedIn(link: ServiceLink, countryId: string): boolean {
  return Boolean(link.blockedIn?.some(block => block.countryId === countryId))
}

function compareServiceLinks(
  a: ServiceLink,
  b: ServiceLink,
  sortOrder: 'default' | 'alphabetical' | 'popular',
  countryId: string,
): number {
  if (sortOrder === 'alphabetical')
    return a.name.localeCompare(b.name)

  const aRank = getServiceSortRank(a, countryId)
  const bRank = getServiceSortRank(b, countryId)

  return bRank.popular - aRank.popular
    || aRank.blocked - bRank.blocked
    || bRank.recommended - aRank.recommended
    || a.name.localeCompare(b.name)
}

export function useUsefulLinks() {
  const selectedCountryId = ref<string>('china') // default to China as an impactful showcase, or 'global'
  const selectedCategory = ref<CategoryId | 'all'>('all')
  const searchQuery = ref('')
  const sortOrder = ref<'default' | 'alphabetical' | 'popular'>('default')
  const includeGlobal = ref(true)

  const allCountries = computed<CountryInfo[]>(() => COUNTRIES_DATA)

  const popularCountries = computed<CountryInfo[]>(() =>
    COUNTRIES_DATA.filter(c => c.popular))

  const currentCountry = computed<CountryInfo>(() => {
    return (
      COUNTRIES_DATA.find(c => c.id === selectedCountryId.value)
      || COUNTRIES_DATA[0]
    )
  })

  const isGlobalView = computed(() => selectedCountryId.value === 'global')

  function isServiceBlocked(link: ServiceLink, countryId: string = selectedCountryId.value): ServiceLinkBlocked | undefined {
    if (!link.blockedIn)
      return undefined

    return link.blockedIn.find(b => b.countryId === countryId)
  }

  function isServicePopularIn(link: ServiceLink, countryId: string = selectedCountryId.value): boolean {
    if (!link.popularIn)
      return false

    return link.popularIn.includes(countryId)
  }

  function getServiceCountryNote(link: ServiceLink, countryId: string = selectedCountryId.value): string | undefined {
    if (!link.countryNotes)
      return undefined

    return link.countryNotes[countryId]
  }

  // Base links matching country filter
  const countryFilteredLinks = computed<ServiceLink[]>(() => {
    const cid = selectedCountryId.value

    if (cid === 'global') {
      return SERVICE_LINKS.filter(link => link.isGlobal || link.countries.includes('global'))
    }

    return SERVICE_LINKS.filter((link) => {
      const isForThisCountry = link.countries.includes(cid)
      const isBlockedInThisCountry = link.blockedIn?.some(b => b.countryId === cid)

      if (isForThisCountry || isBlockedInThisCountry)
        return true

      if (includeGlobal.value && (link.isGlobal || link.countries.includes('global')))
        return true

      return false
    })
  })

  // Full filtered categories
  const filteredCategories = computed<LinkCategoryDisplay[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const targetCategory = selectedCategory.value
    const cid = selectedCountryId.value

    const result: LinkCategoryDisplay[] = []

    for (const category of LINK_CATEGORIES) {
      // If a specific category tab is chosen, skip others
      if (targetCategory !== 'all' && category.id !== targetCategory)
        continue

      // Find links belonging to this category
      const categoryLinks = countryFilteredLinks.value.filter(link => link.categories.includes(category.id))

      // Filter by search
      const searchedLinks = query
        ? categoryLinks.filter(link => matchesLinkSearch(link, query))
        : categoryLinks

      if (searchedLinks.length > 0) {
        // Sort links inside category
        const sorted = [...searchedLinks].sort((a, b) => compareServiceLinks(
          a,
          b,
          sortOrder.value,
          cid,
        ))

        result.push({
          id: category.id,
          title: category.title,
          icon: category.icon,
          links: sorted,
        })
      }
    }

    return result
  })

  // Total count of matched links
  const totalResultsCount = computed(() => {
    return filteredCategories.value.reduce((acc, cat) => acc + cat.links.length, 0)
  })

  function setCountry(id: string) {
    selectedCountryId.value = id
  }

  function setCategory(id: CategoryId | 'all') {
    selectedCategory.value = id
  }

  function clearFilters() {
    searchQuery.value = ''
    selectedCategory.value = 'all'
  }

  return {
    selectedCountryId,
    selectedCategory,
    searchQuery,
    sortOrder,
    allCountries,
    popularCountries,
    currentCountry,
    isGlobalView,
    categories: LINK_CATEGORIES,
    filteredCategories,
    totalResultsCount,
    setCountry,
    setCategory,
    clearFilters,
    isServiceBlocked,
    isServicePopularIn,
    getServiceCountryNote,
  }
}
