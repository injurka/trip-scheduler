package ru.tripscheduler.tracking

import java.util.concurrent.CancellationException

/** Runs the complete native queue; a failed file must not block the remaining day. */
object MemoryExportQueue {
    fun <T> run(
        files: List<T>,
        cancelled: () -> Boolean,
        save: (T) -> Long,
        onResult: (Long?, Exception?) -> Unit,
    ) {
        for (file in files) {
            if (cancelled()) break
            val bytes = try {
                save(file)
            } catch (e: Exception) {
                if (cancelled() || e is CancellationException) break
                onResult(null, e)
                continue
            }
            onResult(bytes, null)
        }
    }
}
