import type { IDatabaseClient } from '~/shared/services/api/model/types'

const databaseServiceInstance = ref<IDatabaseClient | null>(null)

export function setDatabaseService(service: IDatabaseClient) {
  databaseServiceInstance.value = service
}

export function getDatabaseService(): IDatabaseClient {
  const service = databaseServiceInstance.value
  if (!service) {
    throw new Error(
      'Database service has not been initialized. Did you install the request plugin with app.use(requestPlugin)?',
    )
  }

  return service
}
