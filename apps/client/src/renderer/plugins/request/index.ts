import type { App } from 'vue'
import type { RequestPluginOptions } from './models/types'
import { setDatabaseService } from './lib/service'

export * from './composables'
export * from './models'
export * from './store'

export const requestPlugin = {
  install(_: App, options: RequestPluginOptions) {
    if (!options || !options.databaseService) {
      throw new Error(
        'Failed to install requestPlugin: `databaseService` option is required.',
      )
    }

    setDatabaseService(options.databaseService)
  },
}
