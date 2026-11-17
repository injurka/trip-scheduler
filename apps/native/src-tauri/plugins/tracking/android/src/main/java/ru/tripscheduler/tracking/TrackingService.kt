package ru.tripscheduler.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionEvent
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
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

class TrackingService : Service() {

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var locationHandlerThread: HandlerThread? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var activityBroadcastReceiver: BroadcastReceiver? = null
    private var activityPendingIntent: PendingIntent? = null
    private var sessionStartedAt = 0L
    @Volatile private var recordingGeneration = 0L
    @Volatile private var lastFixElapsedMs: Long? = null
    @Volatile private var notificationAccuracy: Float? = null
    private val notificationHandler = Handler(Looper.getMainLooper())
    private val notificationRefresh = object : Runnable {
        override fun run() {
            if (!isRunning && !isStarting) return
            locationHandlerThread?.looper?.let { looper -> Handler(looper).post { synchronized(fileLock) { writeQueue?.flush() } } }
            updateTrackingNotification()
            notificationHandler.postDelayed(this, 15_000L)
        }
    }

    companion object {
        const val CHANNEL_ID = "tripscheduler_tracking_channel"
        const val NOTIFICATION_ID = 90210
        const val ACTION_START = "ru.tripscheduler.tracking.START"
        const val ACTION_STOP = "ru.tripscheduler.tracking.STOP"
        private const val ACTION_NOTIFICATION_DISMISSED = "ru.tripscheduler.tracking.NOTIFICATION_DISMISSED"
        private const val EXTRA_NOTIFICATION_SESSION = "notification_session"
        const val ACTION_ACTIVITY_UPDATE = "ru.tripscheduler.tracking.ACTIVITY_UPDATE"
        private const val BUFFER_FILENAME = "tracking_buffered_points.jsonl"
        private const val PREFS_NAME = "tracking_service_prefs"
        private const val KEY_SESSION_STARTED_AT = "notification_session_started_at"
        private const val KEY_EXPLICITLY_STOPPED = "explicitly_stopped"
        private val fileLock = Any()
        private var writeQueue: GpsWriteQueue? = null
        @Volatile private var contextError: String? = null
        val storageError: String? get() = contextError ?: writeQueue?.error
        @Volatile var legacyQueuePreserved: Boolean = false
            private set
        val pendingWrites: Int get() = writeQueue?.size ?: 0
        val lastSavedTsUtc: Long? get() = writeQueue?.lastSavedAt
        fun ownerId(context: Context): String? = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("ownerId", null)
        fun sessionId(context: Context): String? = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("sessionId", null)


        fun markExplicitlyStopped(context: Context, stopped: Boolean) {
            try {
                context.applicationContext
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(KEY_EXPLICITLY_STOPPED, stopped)
                    .apply {
                        if (stopped) remove(KEY_SESSION_STARTED_AT)
                    }
                    .apply()
            } catch (e: Exception) {
                android.util.Log.w("TrackingService", "Error saving explicitly_stopped state", e)
            }
        }

        fun isExplicitlyStopped(context: Context): Boolean {
            return try {
                context.applicationContext
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getBoolean(KEY_EXPLICITLY_STOPPED, false)
            } catch (_: Exception) {
                false
            }
        }

        fun countBufferedPoints(context: Context): Int {
            synchronized(fileLock) {
                return try {
                    val file = File(context.filesDir, BUFFER_FILENAME)
                    if (!file.exists()) {
                        0
                    } else {
                        BufferedReader(FileReader(file)).use { reader ->
                            var count = 0
                            var line: String? = reader.readLine()
                            while (line != null) {
                                if (line.isNotBlank()) count++
                                line = reader.readLine()
                            }
                            count
                        }
                    }
                } catch (_: Exception) {
                    0
                }
            }
        }

        /** Ключи extras, которыми состояние Activity Recognition приклеивается к точке. */
        const val EXTRA_DEVICE_ACTIVITY = "ru.tripscheduler.tracking.DEVICE_ACTIVITY"
        const val EXTRA_DEVICE_ACTIVITY_CONFIDENCE = "ru.tripscheduler.tracking.DEVICE_ACTIVITY_CONFIDENCE"

        /**
         * Transition API не сообщает confidence: сам факт перехода означает, что детектор
         * различил смену состояния. Число ниже — вес источника, не вероятность Google.
         */
        private const val TRANSITION_CONFIDENCE = 90

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        private var isStarting = false

        /**
         * Текущий способ передвижения по данным Activity Recognition (акселерометр).
         * «unknown» — сигнала нет либо разрешение не выдано.
         */
        @Volatile
        var currentDeviceActivity: String = "unknown"
            private set

        @Volatile
        var currentDeviceActivityConfidence: Int = 0
            private set

        @Volatile
        private var activitySinceNanos: Long = 0

        /**
         * Google DetectedActivity → словарь активностей трека.
         * ON_FOOT/WALKING/RUNNING не различаем: для классификации трека это одна ходьба.
         */
        fun mapDetectedActivity(type: Int): String = when (type) {
            DetectedActivity.STILL -> "still"
            DetectedActivity.ON_FOOT,
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING -> "walk"
            DetectedActivity.ON_BICYCLE -> "bike"
            DetectedActivity.IN_VEHICLE -> "vehicle"
            else -> "unknown"
        }

        @Volatile
        var onLocationReceived: ((Location) -> Unit)? = null

        @Volatile
        var onStateChanged: ((Boolean) -> Unit)? = null


        fun drainBuffer(context: Context, owner: String): List<Location> {
            val list = mutableListOf<Location>()

            synchronized(fileLock) {
                writeQueue?.flush()
                readPersistedPoints(context, list, owner)
            }

            // Дедупликация и сортировка по времени
            return list.distinctBy { it.extras?.getString("clientPointId") ?: "${it.extras?.getString("sessionId")}:${it.time}" }.sortedBy { it.time }.take(500)
        }

        /** Adopt only unowned pre-migration records; tagged records keep their original owner. */
        private fun migrateLegacyBuffer(context: Context, owner: String) {
            val file = File(context.filesDir, BUFFER_FILENAME)
            if (!file.exists()) return
            val lines = file.readLines()
            val hasLegacy = lines.any { line ->
                try { JSONObject(line).optString("ownerId").isEmpty() } catch (_: Exception) { false }
            }
            if (!hasLegacy) return
            val marker = File(context.filesDir, "tracking_legacy_owner")
            if (marker.exists() && marker.readText() != owner) return
            if (!marker.exists()) {
                val markerTemporary = File(context.filesDir, "tracking_legacy_owner.tmp")
                java.io.FileOutputStream(markerTemporary).use { stream ->
                    stream.write(owner.toByteArray(Charsets.UTF_8))
                    stream.fd.sync()
                }
                check(markerTemporary.renameTo(marker)) { "Cannot bind legacy GPS owner" }
            }
            val migrated = lines.map { line ->
                val json = try { JSONObject(line) } catch (_: Exception) { null }
                if (json == null || json.optString("ownerId").isNotEmpty()) line
                else {
                    val timestamp = json.getLong("time")
                    val session = json.optString("sessionId").ifEmpty {
                        java.util.UUID.nameUUIDFromBytes("legacy:$owner:${timestamp / 86400000}".toByteArray()).toString()
                    }
                    val id = json.optString("clientPointId").ifEmpty {
                        java.util.UUID.nameUUIDFromBytes("legacy:$owner:$line".toByteArray()).toString()
                    }
                    json.put("ownerId", owner).put("sessionId", session).put("clientPointId", id).toString()
                }
            }
            val temporary = File(context.filesDir, "$BUFFER_FILENAME.migration")
            java.io.FileOutputStream(temporary).use { stream ->
                stream.write(migrated.joinToString("\n", postfix = "\n").toByteArray(Charsets.UTF_8))
                stream.fd.sync()
            }
            check(temporary.renameTo(file)) { "Cannot migrate GPS buffer" }
        }

        private fun readPersistedPoints(context: Context, out: MutableList<Location>, owner: String) {
            try {
                migrateLegacyBuffer(context, owner)
                legacyQueuePreserved = false
                val file = File(context.filesDir, BUFFER_FILENAME)
                if (file.exists()) {
                    BufferedReader(FileReader(file)).use { reader ->
                        var line: String? = reader.readLine()
                        while (line != null) {
                            if (line.isNotBlank()) {
                                try {
                                    val json = JSONObject(line)
                                    if (json.optString("ownerId").isEmpty()) legacyQueuePreserved = true
                                    if (json.optString("ownerId") != owner) {
                                        line = reader.readLine()
                                        continue
                                    }
                                    val loc = Location("fused").apply {
                                        latitude = json.getDouble("lat")
                                        longitude = json.getDouble("lng")
                                        if (json.has("acc")) accuracy = json.getDouble("acc").toFloat()
                                        if (json.has("alt")) altitude = json.getDouble("alt")
                                        if (json.has("spd")) speed = json.getDouble("spd").toFloat()
                                        if (json.has("brg")) bearing = json.getDouble("brg").toFloat()
                                        time = json.getLong("time")
                                        if (json.has("act")) {
                                            extras = Bundle().apply {
                                                putString(EXTRA_DEVICE_ACTIVITY, json.getString("act"))
                                                putInt(
                                                    EXTRA_DEVICE_ACTIVITY_CONFIDENCE,
                                                    if (json.has("actc")) json.getInt("actc") else 0
                                                )
                                            }
                                        }
                                    }
                                    loc.extras = (loc.extras ?: Bundle()).apply {
                                        putString("ownerId", json.getString("ownerId"))
                                        putString("sessionId", json.getString("sessionId"))
                                        putString("clientPointId", json.getString("clientPointId"))
                                    }
                                    out.add(loc)
                                } catch (_: Exception) {}
                            }
                            line = reader.readLine()
                        }
                    }

                }
            } catch (e: Exception) {
                throw java.io.IOException("Не удалось прочитать GPS-очередь", e)
            }
        }

        fun acknowledgeBuffer(context: Context, clientPointIds: Set<String>, owner: String) {
            synchronized(fileLock) {
                val file = File(context.filesDir, BUFFER_FILENAME)
                if (!file.exists()) return
                val remaining = file.readLines().filter { line ->
                    try { val json = JSONObject(line); json.optString("ownerId") != owner || !clientPointIds.contains(json.optString("clientPointId")) }
                    catch (_: Exception) { true }
                }
                val temporary = File(context.filesDir, "$BUFFER_FILENAME.tmp")
                java.io.FileOutputStream(temporary).use { stream ->
                    stream.write(remaining.joinToString("\n", postfix = if (remaining.isEmpty()) "" else "\n").toByteArray(Charsets.UTF_8))
                    stream.fd.sync()
                }
                check(temporary.renameTo(file)) { "Could not acknowledge GPS buffer" }
            }
        }

        private fun persistPoint(context: Context, location: Location) {
            synchronized(fileLock) {
                try {
                    val json = JSONObject().apply {
                        put("lat", location.latitude)
                        put("lng", location.longitude)
                        if (location.hasAccuracy()) put("acc", location.accuracy)
                        if (location.hasAltitude()) put("alt", location.altitude)
                        if (location.hasSpeed()) put("spd", location.speed)
                        if (location.hasBearing()) put("brg", location.bearing)
                        put("time", location.time)
                        put("ownerId", location.extras?.getString("ownerId"))
                        put("sessionId", location.extras?.getString("sessionId"))
                        put("clientPointId", location.extras?.getString("clientPointId"))
                        // Состояние Activity Recognition переживает гибель процесса вместе с точкой
                        val extras = location.extras
                        val deviceActivity = extras?.getString(EXTRA_DEVICE_ACTIVITY)
                        if (extras != null && !deviceActivity.isNullOrEmpty()) {
                            put("act", deviceActivity)
                            put(
                                "actc",
                                extras.getInt(EXTRA_DEVICE_ACTIVITY_CONFIDENCE, 0)
                            )
                        }
                    }
                    if (writeQueue == null) {
                        val file = File(context.filesDir, BUFFER_FILENAME)
                        writeQueue = GpsWriteQueue { record ->
                            synchronized(fileLock) {
                                java.io.FileOutputStream(file, true).use { stream ->
                                    // A partial previous write cannot swallow the next valid record.
                                    stream.write(("\n" + record + "\n").toByteArray(Charsets.UTF_8))
                                    stream.fd.sync()
                                }
                            }
                        }
                    }
                    writeQueue!!.enqueue(json.toString(), location.time)
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
        if (intent?.action == ACTION_NOTIFICATION_DISMISSED) {
            // Android 14+ allows swiping ongoing notifications. Restore immediately,
            // without restarting GPS or treating a stale dismissal as a new session.
            if (isRunning || isStarting) {
                if (!isExplicitlyStopped(this) &&
                    intent.getLongExtra(EXTRA_NOTIFICATION_SESSION, 0L) == sessionStartedAt
                ) {
                    updateTrackingNotification()
                }
                return START_STICKY
            }
            stopSelf(startId)
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_STOP) {
            markExplicitlyStopped(this, true)
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_START) {
            val owner = intent.getStringExtra("ownerId")
            val session = intent.getStringExtra("sessionId")
            if (owner.isNullOrBlank() || session.isNullOrBlank()) {
                stopSelf(startId)
                return START_NOT_STICKY
            }
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if ((isRunning || isStarting) && prefs.getString("ownerId", null) != owner) {
                stopTracking()
            }
            if (!prefs.edit().putString("ownerId", owner).putString("sessionId", session).commit()) {
                contextError = "Не удалось сохранить владельца GPS-записи. Освободите память устройства."
                stopSelf(startId)
                return START_NOT_STICKY
            }
            contextError = null
            markExplicitlyStopped(this, false)
        } else if (isExplicitlyStopped(this)) {
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }

        // Unowned legacy sessions are retained on disk, but never adopted by another user.
        if (ownerId(this).isNullOrBlank() || sessionId(this).isNullOrBlank()) {
            stopSelf(startId)
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

    private fun buildNotification(): Notification {
        val statusText = storageError?.let { "Ошибка сохранения · ${pendingWrites} точек ожидают записи" } ?: TrackingNotificationContent.status(SystemClock.elapsedRealtime(), lastFixElapsedMs, notificationAccuracy)
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )
        } else null

        val dismissIntent = PendingIntent.getService(
            this,
            3,
            Intent(this, TrackingService::class.java)
                .setAction(ACTION_NOTIFICATION_DISMISSED)
                .putExtra(EXTRA_NOTIFICATION_SESSION, sessionStartedAt),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Запись маршрута")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_notification_trip)
            .setOngoing(true)
            .setAutoCancel(false)
            .setDeleteIntent(dismissIntent)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setWhen(sessionStartedAt)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setColor(getColor(android.R.color.system_accent1_600))
        }
        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        return builder.build()
    }

    @SuppressLint("MissingPermission")
    private fun startTracking() {
        if (!isRunning && !isStarting) {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            val saved = prefs.getLong(KEY_SESSION_STARTED_AT, 0L)
            sessionStartedAt = saved.takeIf { it in 1..now } ?: now
            prefs.edit().putLong(KEY_SESSION_STARTED_AT, sessionStartedAt).apply()
        }

        // Обязательно сразу вызываем startForeground, соблюдая 5-секундный контракт Android 8+
        val notification = buildNotification()
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
            stopSelf()
            return
        }

        if (isRunning || isStarting) return
        isStarting = true
        val generation = ++recordingGeneration
        val recordingOwner = ownerId(this)
        val recordingSession = sessionId(this)
        notificationHandler.removeCallbacks(notificationRefresh)
        notificationHandler.post(notificationRefresh)
        markExplicitlyStopped(this, false)

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
                .setWaitForAccurateLocation(true)
                .build()

            locationCallback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    for (location in result.locations) {
                        if (generation == recordingGeneration) handleLocation(location, recordingOwner, recordingSession)
                    }
                }
            }

            fusedLocationClient?.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                looper
            )?.addOnSuccessListener {
                if (isStarting) {
                    isStarting = false
                    isRunning = true
                    onStateChanged?.invoke(true)
                }
            }?.addOnFailureListener { error ->
                android.util.Log.e("TrackingService", "Location subscription failed", error)
                stopTracking()
                stopSelf()
            }
        } catch (e: Exception) {
            android.util.Log.e("TrackingService", "Failed to request location updates", e)
            stopTracking()
            stopSelf()
            return
        }

        // 3. Подписываемся на смену способа передвижения (акселерометр, независимо от GPS)
        startActivityRecognition()
    }

    /**
     * Подписка на Activity Recognition Transition API. Это второй, независимый от координат
     * источник истины: GPS не отличает покой от медленного движения при плохом приёме,
     * а акселерометр отличает. Без разрешения ACTIVITY_RECOGNITION (Android 10+) тихо
     * отключаемся — трекинг по координатам продолжает работать.
     */
    private fun startActivityRecognition() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED
        ) {
            android.util.Log.i("TrackingService", "Activity Recognition выключен: нет разрешения ACTIVITY_RECOGNITION")
            return
        }

        try {
            val transitions = listOf(
                DetectedActivity.STILL,
                DetectedActivity.WALKING,
                DetectedActivity.RUNNING,
                DetectedActivity.ON_BICYCLE,
                DetectedActivity.IN_VEHICLE
            ).flatMap { type ->
                listOf(
                    ActivityTransition.Builder()
                        .setActivityType(type)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                        .build(),
                    ActivityTransition.Builder()
                        .setActivityType(type)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                        .build()
                )
            }

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    if (intent == null || intent.action != ACTION_ACTIVITY_UPDATE) return
                    val result = ActivityTransitionResult.extractResult(intent) ?: return
                    for (event in result.transitionEvents) {
                        applyActivityTransition(event)
                    }
                }
            }
            activityBroadcastReceiver = receiver
            ContextCompat.registerReceiver(
                this,
                receiver,
                IntentFilter(ACTION_ACTIVITY_UPDATE),
                ContextCompat.RECEIVER_NOT_EXPORTED
            )

            val pendingIntent = PendingIntent.getBroadcast(
                this,
                2,
                Intent(ACTION_ACTIVITY_UPDATE).setPackage(packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            activityPendingIntent = pendingIntent

            ActivityRecognition.getClient(this)
                .requestActivityTransitionUpdates(ActivityTransitionRequest(transitions), pendingIntent)
                .addOnFailureListener { e ->
                    android.util.Log.w("TrackingService", "Activity Recognition не запустился", e)
                }
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Activity Recognition недоступен", e)
        }
    }

    /**
     * Переход «начал / перестал» задаёт текущее состояние: EXIT текущей активности
     * означает, что человек ей больше не занят, и состояние сбрасывается в unknown —
     * ждать ENTER следующей активности не нужно (он может прийти с задержкой).
     */
    private fun applyActivityTransition(event: ActivityTransitionEvent) {
        if (event.elapsedRealTimeNanos < activitySinceNanos) return
        activitySinceNanos = event.elapsedRealTimeNanos
        val activity = mapDetectedActivity(event.activityType)
        if (activity == "unknown") return

        if (event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
            currentDeviceActivity = activity
            currentDeviceActivityConfidence = TRANSITION_CONFIDENCE
        } else if (activity == currentDeviceActivity) {
            currentDeviceActivity = "unknown"
            currentDeviceActivityConfidence = 0
        }
    }

    private fun stopActivityRecognition() {
        val pendingIntent = activityPendingIntent
        if (pendingIntent != null) {
            try {
                ActivityRecognition.getClient(this).removeActivityTransitionUpdates(pendingIntent)
            } catch (e: Exception) {
                android.util.Log.w("TrackingService", "Error removing activity transitions", e)
            }
            activityPendingIntent = null
        }

        val receiver = activityBroadcastReceiver
        if (receiver != null) {
            try {
                unregisterReceiver(receiver)
            } catch (e: Exception) {
                android.util.Log.w("TrackingService", "Error unregistering activity receiver", e)
            }
            activityBroadcastReceiver = null
        }

        currentDeviceActivity = "unknown"
        currentDeviceActivityConfidence = 0
        activitySinceNanos = 0
    }

    private fun handleLocation(location: Location, recordingOwner: String?, recordingSession: String?) {
        if (!isRunning && !isStarting) return
        val firstFix = lastFixElapsedMs == null
        lastFixElapsedMs = location.elapsedRealtimeNanos / 1_000_000L
        notificationAccuracy = if (location.hasAccuracy()) location.accuracy else null

        // 0. Приклеиваем к точке текущее состояние Activity Recognition: без него
        //    классификация видит только координаты и на плохом приёме путает покой с движением.
        location.extras = (location.extras ?: Bundle()).apply {
            putString("ownerId", recordingOwner)
            putString("sessionId", recordingSession)
            putString("clientPointId", java.util.UUID.randomUUID().toString())
            val applicable = location.elapsedRealtimeNanos >= activitySinceNanos
            putString(EXTRA_DEVICE_ACTIVITY, if (applicable) currentDeviceActivity else "unknown")
            putInt(EXTRA_DEVICE_ACTIVITY_CONFIDENCE, if (applicable) currentDeviceActivityConfidence else 0)
        }

        // 2. Сохраняем в файл на диске на случай выгрузки процесса системой
        persistPoint(applicationContext, location)

        // 3. Передаем в реальном времени подписчикам (когда UI активен)
        try {
            onLocationReceived?.invoke(location)
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error dispatching location update", e)
        }

        // First fix is visible immediately; subsequent refreshes are rate-limited by the handler.
        if (firstFix) notificationHandler.post { updateTrackingNotification() }
    }

    private fun updateTrackingNotification() {
        if (!isRunning && !isStarting) return
        try {
            getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, buildNotification())
        } catch (error: Exception) {
            android.util.Log.w("TrackingService", "Notification update failed", error)
        }
    }

    private fun stopTracking() {
        notificationHandler.removeCallbacks(notificationRefresh)
        if (!isRunning && !isStarting) return
        ++recordingGeneration
        isStarting = false
        isRunning = false
        lastFixElapsedMs = null
        notificationAccuracy = null
        onStateChanged?.invoke(false)

        stopActivityRecognition()

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
