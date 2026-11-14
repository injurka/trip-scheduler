package ru.tripscheduler.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** The entire queue belongs to Android, never to the Activity or a JS timer. */
class MemoryExportService : Service() {
    companion object {
        private const val CHANNEL = "trip_scheduler_memory_exports"
        private const val NOTIFICATION_ID = 3104
        private const val CANCEL = "ru.tripscheduler.tracking.CANCEL_MEMORY_EXPORT"
        private val lock = Any()
        private var job: ExportJob? = null
        private var service: MemoryExportService? = null

        fun start(context: Context, files: JSONArray) = synchronized(lock) {
            check(job?.running != true && service == null) { "Скачивание уже выполняется" }
            require(files.length() > 0) { "Нет файлов для скачивания" }
            val items = (0 until files.length()).map { index ->
                val item = files.getJSONObject(index)
                val name = item.getString("fileName")
                require(name.isNotEmpty() && !name.contains('/') && !name.contains('\\') && name != "." && name != "..")
                ExportItem(item.getString("url"), name, item.getString("mimeType"))
            }.distinctBy { it.fileName }
            job = ExportJob(items)
            try {
                // No file list in the Intent: large days must not exceed Binder limits.
                ContextCompat.startForegroundService(context, Intent(context, MemoryExportService::class.java))
            } catch (e: Exception) {
                job = null
                throw e
            }
        }

        fun status(): JSONObject = synchronized(lock) {
            job?.json() ?: JSONObject().put("isDownloading", false).put("total", 0)
        }
    }

    private data class ExportItem(val url: String, val fileName: String, val mimeType: String)
    private class ExportJob(val files: List<ExportItem>) {
        val id = UUID.randomUUID().toString()
        var running = true
        var current = 0
        var skipped = 0
        var failed = 0
        var bytes = 0L
        var cancelled = false
        var error: String? = null
        fun json(): JSONObject = JSONObject()
            .put("id", id).put("isDownloading", running).put("current", current)
            .put("total", files.size).put("skippedCount", skipped).put("failed", failed)
            .put("loadedBytes", bytes).put("cancelled", cancelled).put("error", error ?: JSONObject.NULL)
    }

    private val cancelled = AtomicBoolean(false)
    private val finished = AtomicBoolean(false)
    @Volatile private var connection: HttpURLConnection? = null
    private var worker: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        synchronized(lock) { service = this }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(
                NotificationChannel(CHANNEL, "Скачивание воспоминаний", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == CANCEL) {
            cancel()
            return START_NOT_STICKY
        }
        if (worker != null) return START_NOT_STICKY
        val active = synchronized(lock) { job }
        if (active == null || !active.running) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification(active), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, notification(active))
            }
            wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TripScheduler:MemoryExport").apply {
                    acquire(6 * 60 * 60 * 1000L)
                }
            worker = Thread {
                try {
                    MemoryExportQueue.run(active.files, { cancelled.get() }, save = { file ->
                        MemoryExporter.save(applicationContext, file.url, file.fileName, file.mimeType,
                            cancelled = { cancelled.get() }, onConnection = { connection = it })
                    }, onResult = result@ { bytes, error ->
                        if (finished.get()) return@result
                        synchronized(lock) {
                            if (error != null) active.failed++
                            else if (bytes == 0L) active.skipped++
                            else active.bytes += bytes ?: 0L
                            active.current++
                        }
                        if (error != null) android.util.Log.w("MemoryExportService", "Memory export failed", error)
                        getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification(active))
                    })
                } finally {
                    Handler(Looper.getMainLooper()).post { finish(active) }
                }
            }.apply { name = "memory-export"; start() }
        } catch (e: Exception) {
            synchronized(lock) { active.error = "Не удалось запустить фоновое скачивание: ${e.message}" }
            cancel()
            finish(active)
        }
        // Swiping the Activity away does not stop this service. Force-stop does.
        return START_NOT_STICKY
    }

    private fun cancel() {
        cancelled.set(true)
        // Interrupt a blocked read as well as checking the flag between chunks/files.
        val activeConnection = connection
        if (activeConnection != null) {
            // Some HTTP implementations may block in disconnect; keep the main thread free.
            Thread { runCatching { activeConnection.disconnect() } }.start()
        }
        worker?.interrupt()
    }

    private fun finish(active: ExportJob) {
        if (finished.getAndSet(true)) return
        synchronized(lock) { active.running = false; active.cancelled = cancelled.get() }
        if (wakeLock?.isHeld == true) wakeLock?.release()
        stopForeground(STOP_FOREGROUND_REMOVE)
        getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification(active))
        stopSelf()
    }

    private fun notification(active: ExportJob): Notification = synchronized(lock) {
        val saved = active.current - active.failed - active.skipped
        val text = when {
            active.error != null -> active.error!!
            !active.running && active.cancelled -> "Остановлено. Сохранено: $saved. Уже на устройстве: ${active.skipped}"
            !active.running -> "Сохранено: $saved. Уже на устройстве: ${active.skipped}. Ошибок: ${active.failed}"
            else -> "Обработано ${active.current} из ${active.files.size} · сохранено $saved · уже есть ${active.skipped} · ошибок ${active.failed}"
        }
        val builder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(when {
                active.running -> "Скачивание воспоминаний"
                active.error != null || active.cancelled -> "Скачивание воспоминаний остановлено"
                else -> "Скачивание воспоминаний завершено"
            })
            .setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setOnlyAlertOnce(true).setOngoing(active.running).setAutoCancel(!active.running)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (active.running) {
            builder.setProgress(active.files.size, active.current, false)
            val pending = PendingIntent.getService(this, 3104, Intent(this, MemoryExportService::class.java).setAction(CANCEL),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Остановить", pending)
        }
        packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
            builder.setContentIntent(PendingIntent.getActivity(this, 3105, launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        builder.build()
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        synchronized(lock) { job?.error = "Android остановил длительное скачивание. Повторите скачивание оставшихся файлов." }
        cancel()
        // Android 15 requires stopSelf within seconds, without waiting on network IO.
        synchronized(lock) { job?.let { finish(it) } }
    }

    override fun onDestroy() {
        finished.set(true)
        cancel()
        if (wakeLock?.isHeld == true) wakeLock?.release()
        synchronized(lock) {
            service = null
            job?.let { if (it.running) { it.running = false; it.cancelled = true } }
        }
        super.onDestroy()
    }
}
