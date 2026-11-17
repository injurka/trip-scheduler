package ru.tripscheduler.tracking

/** Failed writes stay in memory and are retried in order. Only fsync confirms storage. */
internal class GpsWriteQueue(private val append: (String) -> Unit) {
    private val pending = ArrayDeque<Pair<String, Long>>()
    @Volatile var error: String? = null
        private set
    @Volatile var lastSavedAt: Long? = null
        private set
    val size: Int get() = synchronized(this) { pending.size }

    @Synchronized fun enqueue(record: String, timestamp: Long) {
        pending.addLast(record to timestamp)
        flush()
    }

    @Synchronized fun flush() {
        while (pending.isNotEmpty()) {
            val (record, timestamp) = pending.first()
            try {
                append(record)
                lastSavedAt = timestamp
                pending.removeFirst()
                error = null
            } catch (failure: Exception) {
                error = "Не удалось сохранить GPS на устройстве: ${failure.message ?: failure.javaClass.simpleName}. Ожидают записи: ${pending.size}"
                return
            }
        }
    }
}
