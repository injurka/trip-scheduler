import type { Plugin, UserConfig } from 'vite'
import { resolve } from 'node:path'
import { build, createServer } from 'vite'
import staticPages from '../../src/renderer/static-pages/pages.json' with { type: 'json' }

/** Build public pages independently from the application and its services. */
export function buildStaticPages(createConfig: () => UserConfig): Plugin {
  let files: Array<{ fileName: string, source: string | Uint8Array }> = []
  const prerender = (page: typeof staticPages[number]): Plugin => ({
    name: `prerender-${page.slug}`,
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const server = await createServer({
          ...createConfig(),
          configFile: false,
          server: { middlewareMode: true, hmr: false, ws: false },
          appType: 'custom',
        })

        try {
          const { render } = await server.ssrLoadModule('/static-pages/render.ts')
          const { default: component } = await server.ssrLoadModule(page.component)

          const rendered = html.replace('<!--static-html-->', await render(component)).replace('<!--static-title-->', page.title).replace('<!--static-description-->', page.description)

          return page.hydrate ? rendered : rendered.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
        }
        finally {
          await server.close()
        }
      },
    },
  })

  return {
    name: 'static-pages',
    apply: 'build',
    async buildStart() {
      files = []

      for (const page of staticPages) {
        const ssrConfig = createConfig()
        const result = await build({
          ...ssrConfig,
          configFile: false,
          base: '/',
          publicDir: false,
          plugins: [...(ssrConfig.plugins ?? []), prerender(page)],
          build: {
            write: false,
            rollupOptions: {
              input: resolve(ssrConfig.root!, `static-pages/${page.slug}/index.html`),
              output: {
                entryFileNames: 'static-assets/[name]-[hash].js',
                chunkFileNames: 'static-assets/[name]-[hash].js',
                assetFileNames: 'static-assets/[name]-[hash][extname]',
              },
            },
          },
        })

        if (!('output' in result))
          throw new Error('Expected a single static page build output')

        files.push(...result.output.map(file => ({
          fileName: file.fileName === `static-pages/${page.slug}/index.html` ? `${page.slug}/index.html` : file.fileName,
          source: file.type === 'asset' ? file.source : file.code,
        })))
      }
    },
    generateBundle() {
      for (const file of new Map(files.map(file => [file.fileName, file])).values())
        this.emitFile({ type: 'asset', ...file })
    },
  }
}
