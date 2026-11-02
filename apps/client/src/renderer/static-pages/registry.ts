import pages from './pages.json'

/** Shared by the build, router and service worker. */
export const staticPages = pages

export function findStaticPage(path: string) {
  return staticPages.find(page => path === `/${page.slug}` || path === `/${page.slug}/` || path === `/${page.slug}/index.html`)
}
