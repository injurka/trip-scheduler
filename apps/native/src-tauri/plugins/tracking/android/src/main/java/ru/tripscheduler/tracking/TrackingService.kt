package ru.tripscheduler.tracking

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.io.FileWriter
import java.util.concurrent.ConcurrentLinkedQueue

class TrackingService : Service() {

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var locationHandlerThread: HandlerThread? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var recordedCount = 0

    companion object {
        const val CHANNEL_ID = "tripscheduler_tracking_channel"
        const val NOTIFICATION_ID = 90210
        const val ACTION_START = "ru.tripscheduler.tracking.START"
        const val ACTION_STOP = "ru.tripscheduler.tracking.STOP"
        private const val BUFFER_FILENAME = "tracking_buffered_points.jsonl"
        private val fileLock = Any()

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        var onLocationReceived: ((Location) -> Unit)? = null

        @Volatile
        var onStateChanged: ((Boolean) -> Unit)? = null

        val locationBuffer = ConcurrentLinkedQueue<Location>()
        private const val MAX_RAM_BUFFER_SIZE = 5000

        fun drainBuffer(context: Context): List<Location> {
            val list = mutableListOf<Location>()

            // 1. Извлекаем точки из оперативной памяти
            while (true) {
                val loc = locationBuffer.poll() ?: break
                list.add(loc)
            }

            // 2. Считываем сохраненный на диск буфер (для защиты от выгрузки процесса ОС)
            synchronized(fileLock) {
                try {
                    val file = File(context.filesDir, BUFFER_FILENAME)
                    if (file.exists()) {
                        BufferedReader(FileReader(file)).use { reader ->
                            var line: String? = reader.readLine()
                            while (line != null) {
                                if (line.isNotBlank()) {
                                    try {
                                        val json = JSONObject(line)
                                        val loc = Location("fused").apply {
                                            latitude = json.getDouble("lat")
                                            longitude = json.getDouble("lng")
                                            if (json.has("acc")) accuracy = json.getDouble("acc").toFloat()
                                            if (json.has("alt")) altitude = json.getDouble("alt")
                                            if (json.has("spd")) speed = json.getDouble("spd").toFloat()
                                            if (json.has("brg")) bearing = json.getDouble("brg").toFloat()
                                            time = json.getLong("time")
                                        }
                                        list.add(loc)
                                    } catch (_: Exception) {}
                                }
                                line = reader.readLine()
                            }
                        }
                        file.delete()
                    }
                } catch (e: Exception) {
                    android.util.Log.w("TrackingService", "Error reading persistent buffer", e)
                }
            }

            // Дедупликация и сортировка по времени
            return list.distinctBy { it.time }.sortedBy { it.time }
        }

        private fun persistPoint(context: Context, location: Location) {
            synchronized(fileLock) {
                try {
                    val file = File(context.filesDir, BUFFER_FILENAME)
                    val json = JSONObject().apply {
                        put("lat", location.latitude)
                        put("lng", location.longitude)
                        if (location.hasAccuracy()) put("acc", location.accuracy)
                        if (location.hasAltitude()) put("alt", location.altitude)
                        if (location.hasSpeed()) put("spd", location.speed)
                        if (location.hasBearing()) put("brg", location.bearing)
                        put("time", location.time)
                    }
                    FileWriter(file, true).use { writer ->
                        writer.write(json.toString() + "\n")
                    }
                } catch (e: Exception) {
                    android.util.Log.w("TrackingService", "Error persisting location to disk", e)
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }

        startTracking()
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TripScheduler Фоновый GPS-трекинг",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Уведомление активного сервиса записи маршрута"
                setShowBadge(false)
                enableVibration(false)
                enableLights(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )
        } else null

        val stopIntent = Intent(this, TrackingService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val appIcon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_menu_mylocation

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TripScheduler: Запись маршрута")
            .setContentText(statusText)
            .setSmallIcon(appIcon)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Остановить", stopPendingIntent)

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        return builder.build()
    }

    @SuppressLint("MissingPermission")
    private fun startTracking() {
        // Обязательно сразу вызываем startForeground, соблюдая 5-секундный контракт Android 8+
        val notification = buildNotification(if (recordedCount > 0) "Записано точек: $recordedCount" else "GPS-трекинг активен")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            android.util.Log.e("TrackingService", "Failed to start foreground", e)
        }

        if (isRunning) return
        isRunning = true
        recordedCount = 0
        onStateChanged?.invoke(true)

        // 1. Захватываем CPU Partial WakeLock для предотвращения сна процессора при заблокированном экране
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "TripScheduler:TrackingServiceWakeLock"
            ).apply {
                setReferenceCounted(false)
                acquire(24 * 60 * 60 * 1000L) // Таймаут безопасности 24 часа
            }
        } catch (e: Exception) {
            android.util.Log.e("TrackingService", "Failed to acquire wake lock", e)
        }

        // 2. Создаем отдельный HandlerThread для изоляции вызовов GPS от главного/UI потока и WebView
        try {
            locationHandlerThread = HandlerThread("TripSchedulerTrackerThread").apply { start() }
            val looper = locationHandlerThread?.looper ?: Looper.getMainLooper()

            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000L)
                .setMinUpdateIntervalMillis(1500L)
                .setMaxUpdateDelayMillis(0L) // Немедленная доставка координат без накопления в Play Services
                .setMinUpdateDistanceMeters(0f)
                .setWaitForAccurateLocation(false)
                .build()

            locationCallback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    for (location in result.locations) {
                        handleLocation(location)
                    }
                }
            }

            fusedLocationClient?.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                looper
            )
        } catch (e: Exception) {
            android.util.Log.e("TrackingService", "Failed to request location updates", e)
        }
    }

    private fun handleLocation(location: Location) {
        recordedCount++

        // 1. Сохраняем в оперативную очередь
        if (locationBuffer.size >= MAX_RAM_BUFFER_SIZE) {
            locationBuffer.poll()
        }
        locationBuffer.offer(location)

        // 2. Сохраняем в файл на диске на случай выгрузки процесса системой
        persistPoint(applicationContext, location)

        // 3. Передаем в реальном времени подписчикам (когда UI активен)
        try {
            onLocationReceived?.invoke(location)
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error dispatching location update", e)
        }

        // 4. Периодически обновляем статус в шторке и на экране блокировки
        if (recordedCount % 5 == 0) {
            try {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, buildNotification("Записано точек: $recordedCount"))
            } catch (_: Exception) {}
        }
    }

    private fun stopTracking() {
        if (!isRunning) return
        isRunning = false
        onStateChanged?.invoke(false)

        try {
            if (locationCallback != null) {
                fusedLocationClient?.removeLocationUpdates(locationCallback!!)
                locationCallback = null
            }
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error removing location updates", e)
        }

        try {
            locationHandlerThread?.quitSafely()
            locationHandlerThread = null
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error quitting handler thread", e)
        }

        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error releasing wake lock", e)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error stopping foreground service", e)
        }
    }

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }
}
