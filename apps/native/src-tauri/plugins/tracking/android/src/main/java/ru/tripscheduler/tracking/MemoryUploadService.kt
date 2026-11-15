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
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** The entire queue belongs to Android, never to the Activity or a JS timer. */
class MemoryUploadService : Service() {
    companion object {
        private const val CHANNEL = "trip_scheduler_memory_uploads"
        private const val NOTIFICATION_ID = 3106
        private const val CANCEL = "ru.tripscheduler.tracking.CANCEL_MEMORY_UPLOAD"
        private val lock = Any()
        private var job: UploadJob? = null
        private var service: MemoryUploadService? = null

        fun start(context: Context, config: JSONObject) = synchronized(lock) {
            check(job?.running != true && service == null) { "Загрузка уже выполняется" }
            val files = config.getJSONArray("files")
            require(files.length() > 0)
            val items = (0 until files.length()).map { files.getJSONObject(it) }
            for (item in items) require(MemoryUploadFiles.path(context, item.getString("id")).length() == item.getLong("size")) { "Файл ещё не подготовлен" }
            job = UploadJob(items, config)
            try {
                ContextCompat.startForegroundService(context, Intent(context, MemoryUploadService::class.java))
            } catch (e: Exception) { job = null; throw e }
        }

        fun cancelItem(id: String) = synchronized(lock) {
            job?.files?.filter { it.getString("id") == id }?.forEach {
                it.put("cancelled", true)
                if (it.optString("status") == "uploading") {
                    val http = service?.uploader?.connection
                    Thread { runCatching { http?.disconnect() } }.start()
                }
            }
        }
        fun cancelAll() { service?.cancel() }
        fun status(): JSONObject = synchronized(lock) {
            job?.json() ?: JSONObject().put("isRunning", false).put("total", 0)
        }
    }

    private class UploadJob(val files: List<JSONObject>, val config: JSONObject) {
        val id = UUID.randomUUID().toString()
        var running = true
        var current = 0
        var skipped = 0
        var failed = 0
        var bytes = 0L
        var cancelled = false
        var error: String? = null
        fun json(): JSONObject = JSONObject().put("id", id).put("tripId", config.getString("tripId"))
            .put("isRunning", running).put("current", current).put("total", files.size)
            .put("skippedCount", skipped).put("failed", failed).put("loadedBytes", bytes)
            .put("cancelled", cancelled).put("error", error ?: JSONObject.NULL).put("items", JSONArray(files))
            .put("accountId", config.optString("accountId"))
            .put("tokens", synchronized(config) { if (config.optBoolean("refreshed")) JSONObject().put("accessToken", config.getString("accessToken")).put("refreshToken", config.getString("refreshToken")) else JSONObject.NULL })
    }

    private val cancelled = AtomicBoolean(false)
    private val finished = AtomicBoolean(false)
    private var uploader: MemoryUploader? = null
    private var worker: Thread? = null
    private var lastNotification = 0L
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        synchronized(lock) { service = this }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(
                NotificationChannel(CHANNEL, "Загрузка воспоминаний", NotificationManager.IMPORTANCE_LOW)
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
                    val engine = MemoryUploader(applicationContext, active.config)
                    uploader = engine
                    for (item in active.files) {
                        if (cancelled.get()) break
                        if (item.optBoolean("cancelled")) { item.put("status", "cancelled"); MemoryUploadFiles.path(applicationContext, item.getString("id")).delete(); continue }
                        synchronized(lock) { item.put("status", "uploading").put("progress", 0) }
                        try {
                            engine.upload(item, { cancelled.get() || item.optBoolean("cancelled") }) { percent ->
                                synchronized(lock) { item.put("progress", percent) }
                                val now = android.os.SystemClock.elapsedRealtime()
                                if (now - lastNotification > 750) {
                                    lastNotification = now
                                    getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification(active))
                                }
                            }
                            synchronized(lock) { item.put("status", "success"); active.current++ }
                            MemoryUploadFiles.path(applicationContext, item.getString("id")).delete()
                        } catch (e: Exception) {
                            synchronized(lock) {
                                if (cancelled.get() || item.optBoolean("cancelled")) item.put("status", "cancelled")
                                else { item.put("status", "error").put("error", e.message ?: "Ошибка загрузки"); active.failed++ }
                            }
                            if (cancelled.get()) break
                        if (item.optBoolean("cancelled")) { item.put("status", "cancelled"); MemoryUploadFiles.path(applicationContext, item.getString("id")).delete(); continue }
                        }
                        getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification(active))
                    }
                } catch (error: Exception) {
                    synchronized(lock) { active.error = error.message ?: "Не удалось выполнить загрузку" }
                } finally {
                    Handler(Looper.getMainLooper()).post { finish(active) }
                }
            }.apply { name = "memory-export"; start() }
        } catch (e: Exception) {
            synchronized(lock) { active.error = "Не удалось запустить фоновое загрузку: ${e.message}" }
            cancel()
            finish(active)
        }
        // Swiping the Activity away does not stop this service. Force-stop does.
        return START_NOT_STICKY
    }

    private fun cancel() {
        cancelled.set(true)
        // Interrupt a blocked read as well as checking the flag between chunks/files.
        val activeConnection = uploader?.connection
        if (activeConnection != null) {
            // Some HTTP implementations may block in disconnect; keep the main thread free.
            Thread { runCatching { activeConnection.disconnect() } }.start()
        }
        worker?.interrupt()
    }

    private fun finish(active: UploadJob) {
        if (finished.getAndSet(true)) return
        synchronized(lock) {
            active.running = false; active.cancelled = cancelled.get()
            if (active.cancelled) active.files.filter { it.optString("status") !in listOf("success", "error") }.forEach { it.put("status", "cancelled") }
        }
        if (active.cancelled) active.files.filter { it.optString("status") == "cancelled" }.forEach { MemoryUploadFiles.path(applicationContext, it.getString("id")).delete() }
        if (wakeLock?.isHeld == true) wakeLock?.release()
        stopForeground(STOP_FOREGROUND_REMOVE)
        getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification(active))
        stopSelf()
    }

    private fun notification(active: UploadJob): Notification = synchronized(lock) {
        val saved = active.current
        val text = when {
            active.error != null -> active.error!!
            !active.running && active.cancelled -> "Остановлено. Загружено: $saved."
            !active.running -> "Загружено: $saved.. Ошибок: ${active.failed}"
            else -> "Загружено ${active.current} из ${active.files.size} · ошибок ${active.failed}"
        }
        val currentPercent = active.files.firstOrNull { it.optString("status") == "uploading" }?.optInt("progress") ?: 0
        val totalProgress = active.current * 100 + currentPercent
        val builder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle(when {
                active.running -> "Загрузка воспоминаний"
                active.error != null || active.cancelled -> "Загрузка воспоминаний остановлена"
                else -> "Загрузка воспоминаний завершена"
            })
            .setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setOnlyAlertOnce(true).setOngoing(active.running).setAutoCancel(!active.running)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (active.running) {
            builder.setProgress(active.files.size * 100, totalProgress, false)
            builder.setSubText("Текущий файл: $currentPercent%")
            val pending = PendingIntent.getService(this, 3106, Intent(this, MemoryUploadService::class.java).setAction(CANCEL),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Остановить", pending)
        }
        packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
            builder.setContentIntent(PendingIntent.getActivity(this, 3107, launch,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        val notification = builder.build()
        if (active.running && Build.VERSION.SDK_INT >= 36) {
            // ProgressStyle is available on Android 16; ordinary progress remains on older OS versions.
            Notification.Builder.recoverBuilder(this, notification)
                .setStyle(Notification.ProgressStyle()
                    .setProgressSegments(active.files.map { Notification.ProgressStyle.Segment(100) })
                    .setProgress(totalProgress))
                .build()
        } else notification
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        synchronized(lock) { job?.error = "Android остановил длительное загрузку. Повторите загрузку оставшихся файлов." }
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
