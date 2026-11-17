/** Indexed rows keep large queues off synchronous Web Storage; legacy storage is migrated only after commit. */
export function createTrackingQueue<
  T extends { clientPointId: string, tsUtc: number },
>(legacy: {
  read: (owner: string | null) => T[]
  write: (owner: string | null, points: T[]) => void
  snapshot: (owner: string | null) => string | null
  clear: (owner: string | null, snapshot: string | null) => void
}) {
  let database: Promise<IDBDatabase> | undefined
  const counts = new Map<string | null, number>()
  const errors = new Map<string | null, string>()
  const migrations = new Map<string | null, Promise<void>>()
  const supported = () => typeof indexedDB !== 'undefined'
  function request<R>(req: IDBRequest<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () =>
        reject(req.error ?? new Error('Ошибка GPS-хранилища'))
    })
  }
  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('tripscheduler-gps', 1)
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('points', {
          keyPath: ['owner', 'clientPointId'],
        })
        store.createIndex('ownerTime', ['owner', 'tsUtc'])
      }
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close()
          database = undefined
        }
        resolve(req.result)
      }
      req.onerror = () => {
        database = undefined
        reject(req.error ?? new Error('Не удалось открыть GPS-хранилище'))
      }
      req.onblocked = () =>
        reject(new Error('Закройте старые вкладки приложения, чтобы открыть GPS-хранилище'))
    })

    return database
  }
  function done(tx: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () =>
        reject(tx.error ?? new Error('GPS-транзакция отменена'))
      tx.onerror = () => {}
    })
  }
  async function writeRows(db: IDBDatabase, owner: string | null, points: T[]) {
    const tx = db.transaction('points', 'readwrite')
    const complete = done(tx)

    try {
      for (const point of points) {
        tx.objectStore('points').put({
          ...point,
          owner: owner ?? 'unassigned',
        })
      }
    }
    catch (error) {
      tx.abort()
      await complete.catch(() => {})
      throw error
    }

    await complete
  }
  const range = (owner: string | null, from = 0, until = Number.MAX_SAFE_INTEGER) =>
    IDBKeyRange.bound(
      [owner ?? 'unassigned', from],
      [owner ?? 'unassigned', until],
      false,
      true,
    )
  async function migrate(owner: string | null) {
    const active = migrations.get(owner)

    if (active)
      return active

    const work = (async () => {
      const db = await open()
      const snapshot = legacy.snapshot(owner)
      const points = legacy.read(owner)

      if (points.length) {
        await writeRows(db, owner, points)
        legacy.clear(owner, snapshot)
      }

      errors.delete(owner)
    })()
      .catch((error) => {
        errors.set(owner, `Не удалось сохранить GPS: ${error instanceof Error ? error.message : 'Ошибка хранилища'}. Исходная очередь сохранена.`)
        throw error
      })
      .finally(() => migrations.delete(owner))
    migrations.set(owner, work)

    return work
  }
  async function count(owner: string | null) {
    if (!supported())
      return legacy.read(owner).length

    let migrationError: unknown

    try {
      await migrate(owner)
    }
    catch (error) {
      migrationError = error
    }

    const db = await open()
    const size = await request(db
      .transaction('points')
      .objectStore('points')
      .index('ownerTime')
      .count(range(owner)))
    counts.set(owner, size)

    if (!size && migrationError)
      throw migrationError

    return size
  }
  async function read(
    owner: string | null,
    limit = 500,
    from = 0,
    until = Number.MAX_SAFE_INTEGER,
  ): Promise<T[]> {
    if (!supported()) {
      return legacy
        .read(owner)
        .filter(p => p.tsUtc >= from && p.tsUtc < until)
        .slice(0, limit)
    }

    let migrationError: unknown

    try {
      await migrate(owner)
    }
    catch (error) {
      migrationError = error
    }

    const db = await open()
    const rows = (await request(db
      .transaction('points')
      .objectStore('points')
      .index('ownerTime')
      .getAll(range(owner, from, until), Math.min(limit, 0xFFFFFFFF)))) as Array<T & { owner: string }>

    if (!rows.length && migrationError)
      throw migrationError

    return rows.map(({ owner: _owner, ...point }) => point as unknown as T)
  }
  async function put(owner: string | null, points: T[]) {
    if (!supported()) {
      const merged = new Map(legacy.read(owner).map(p => [p.clientPointId, p]))
      points.forEach(p => merged.set(p.clientPointId, p))
      legacy.write(owner, [...merged.values()])

      return
    }

    await migrate(owner)
    const db = await open()
    await writeRows(db, owner, points)
    await count(owner)
  }
  async function remove(owner: string | null, ids: string[]) {
    if (!supported()) {
      const selected = new Set(ids)
      legacy.write(owner, legacy.read(owner).filter(p => !selected.has(p.clientPointId)))

      return
    }

    // Acknowledgement never depends on importing a failing legacy batch first.
    const db = await open()
    const tx = db.transaction('points', 'readwrite')
    const complete = done(tx)

    for (const id of ids)
      tx.objectStore('points').delete([owner ?? 'unassigned', id])

    await complete
    const size = await request(db
      .transaction('points')
      .objectStore('points')
      .index('ownerTime')
      .count(range(owner)))
    counts.set(owner, size)
  }

  return {
    read,
    put,
    remove,
    count,
    error: (owner: string | null) => errors.get(owner) ?? null,
    cachedCount: (owner: string | null) =>
      supported() ? (counts.get(owner) ?? 0) : legacy.read(owner).length,
  }
}
