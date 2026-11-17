package ru.tripscheduler.tracking

import android.content.Context
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

internal object GpsBackgroundSync {
    @Volatile private var config: JSONObject? = null
    @Volatile var error: String? = null
        private set
    @Volatile var lastSyncAt: Long? = null
        private set
    private val inFlight = AtomicBoolean(false)
    val syncing: Boolean get() = inFlight.get()
    @Volatile private var executor: java.util.concurrent.ScheduledExecutorService? = null
    fun configured(owner: String?): Boolean = owner != null && config?.optString("ownerId") == owner
    @Synchronized fun configure(context: Context, value: JSONObject?) {
        if (value == null) { config = null; lastSyncAt = null }
        GpsSyncConfig.save(context, value)
        config = value
        lastSyncAt = value?.optString("ownerId")?.let { savedSyncTime(context, it) }
        error = null
        if (value == null) {
            val connection = GpsSyncEngine.connection
            Thread { runCatching { connection?.disconnect() } }.start()
        }
        else if (TrackingService.isRunning) { start(context); executor?.execute { sync(context) } }
    }
    private fun savedSyncTime(context: Context, owner: String): Long? = context.getSharedPreferences("tracking_native_sync_state", Context.MODE_PRIVATE).getLong("lastSync:$owner", 0L).takeIf { it > 0L }
    private fun recordAcknowledged(context: Context, owner: String, ids: Set<String>) {
        TrackingService.acknowledgeBuffer(context, ids, owner)
        if (ids.isNotEmpty()) {
            val now = System.currentTimeMillis()
            lastSyncAt = now
            context.getSharedPreferences("tracking_native_sync_state", Context.MODE_PRIVATE).edit().putLong("lastSync:$owner", now).apply()
        }
    }
    @Synchronized fun start(context: Context) {
        if (config == null) try { config = GpsSyncConfig.load(context) } catch (_: Exception) { error = "Не удалось прочитать ключ отправки GPS. Откройте приложение и войдите в аккаунт." }
        config?.optString("ownerId")?.let { lastSyncAt = savedSyncTime(context, it) }
        if (executor != null) return
        executor = Executors.newSingleThreadScheduledExecutor().apply { scheduleWithFixedDelay({ sync(context.applicationContext) }, 0, 60, TimeUnit.SECONDS) }
    }
    @Synchronized fun stop() {
        executor?.shutdownNow(); executor = null
        val connection = GpsSyncEngine.connection
        Thread { runCatching { connection?.disconnect() } }.start()
    }
    fun sync(context: Context): Int {
        val captured = config ?: return 0
        if (!inFlight.compareAndSet(false, true)) return 0
        return try {
            val count = GpsSyncEngine(
                { owner -> TrackingService.journalRows(context, owner) },
                { owner, ids -> recordAcknowledged(context, owner, ids) },
                { if (config === captured) captured.optString("ownerId") else null }
            ).run(captured)
            if (count > 0) lastSyncAt = System.currentTimeMillis()
            error = null
            count
        } catch (failure: Exception) {
            if (config === captured) error = "${failure.message ?: "Не удалось отправить GPS"}. Точки сохранены на устройстве."
            0
        } finally { inFlight.set(false) }
    }
}
