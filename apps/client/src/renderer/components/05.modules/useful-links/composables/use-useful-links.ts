import type { CategoryId, CountryInfo, LinkCategoryDisplay, ServiceLink, ServiceLinkBlocked } from '../models/types'
import { COUNTRIES_DATA, LINK_CATEGORIES, SERVICE_LINKS } from '../lib/data'

export function useUsefulLinks() {
  const selectedCountryId = ref<string>('china') // default to China as an impactful showcase, or 'global'
  const selectedCategory = ref<CategoryId | 'all'>('all')
  const searchQuery = ref('')
  const sortOrder = ref<'default' | 'alphabetical' | 'popular'>('default')
  const selectedTags = ref<string[]>([])
  const includeGlobal = ref(true)

  const allCountries = computed<CountryInfo[]>(() => COUNTRIES_DATA)

  const popularCountries = computed<CountryInfo[]>(() =>
    COUNTRIES_DATA.filter(c => c.popular),
  )

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

  // All tags available for current country links
  const allTags = computed(() => {
    const tags = new Set<string>()
    for (const link of countryFilteredLinks.value) {
      if (link.tags) {
        link.tags.forEach(tag => tags.add(tag))
      }
    }
    return Array.from(tags).sort()
  })

  // Full filtered categories
  const filteredCategories = computed<LinkCategoryDisplay[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const targetCategory = selectedCategory.value
    const activeTags = selectedTags.value
    const cid = selectedCountryId.value

    const result: LinkCategoryDisplay[] = []

    for (const category of LINK_CATEGORIES) {
      // If a specific category tab is chosen, skip others
      if (targetCategory !== 'all' && category.id !== targetCategory)
        continue

      // Find links belonging to this category
      const categoryLinks = countryFilteredLinks.value.filter(link =>
        link.categories.includes(category.id),
      )

      // Filter by search
      const searchedLinks = query
        ? categoryLinks.filter((link) => {
            const matchName = link.name.toLowerCase().includes(query)
            const matchDesc = link.description.toLowerCase().includes(query)
            const matchTags = link.tags?.some(t => t.toLowerCase().includes(query))
            const matchCountryNote = link.countryNotes && Object.values(link.countryNotes).some(n => n.toLowerCase().includes(query))
            return matchName || matchDesc || matchTags || matchCountryNote
          })
        : categoryLinks

      // Filter by tags
      const taggedLinks = activeTags.length > 0
        ? searchedLinks.filter(link =>
            activeTags.every(tag => link.tags?.includes(tag)),
          )
        : searchedLinks

      if (taggedLinks.length > 0) {
        // Sort links inside category
        const sorted = [...taggedLinks].sort((a, b) => {
          if (sortOrder.value === 'alphabetical') {
            return a.name.localeCompare(b.name)
          }

          // Prioritize top popular in this specific country
          const aPop = isServicePopularIn(a, cid) ? 1 : 0
          const bPop = isServicePopularIn(b, cid) ? 1 : 0
          if (aPop !== bPop)
            return bPop - aPop

          // Non-blocked before blocked
          const aBlocked = isServiceBlocked(a, cid) ? 1 : 0
          const bBlocked = isServiceBlocked(b, cid) ? 1 : 0
          if (aBlocked !== bBlocked)
            return aBlocked - bBlocked

          // Recommended next
          const aRec = a.recommended ? 1 : 0
          const bRec = b.recommended ? 1 : 0
          if (aRec !== bRec)
            return bRec - aRec

          return a.name.localeCompare(b.name)
        })

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
    // Clear tags if no longer relevant or keep tags
    selectedTags.value = []
  }

  function setCategory(id: CategoryId | 'all') {
    selectedCategory.value = id
  }

  function toggleTag(tag: string) {
    const index = selectedTags.value.indexOf(tag)
    if (index > -1) {
      selectedTags.value.splice(index, 1)
    }
    else {
      selectedTags.value.push(tag)
    }
  }

  function clearFilters() {
    searchQuery.value = ''
    selectedTags.value = []
    selectedCategory.value = 'all'
    includeGlobal.value = true
  }

  return {
    selectedCountryId,
    selectedCategory,
    searchQuery,
    sortOrder,
    selectedTags,
    includeGlobal,
    allCountries,
    popularCountries,
    currentCountry,
    isGlobalView,
    categories: LINK_CATEGORIES,
    allTags,
    filteredCategories,
    totalResultsCount,
    setCountry,
    setCategory,
    toggleTag,
    clearFilters,
    isServiceBlocked,
    isServicePopularIn,
    getServiceCountryNote,
  }
}
