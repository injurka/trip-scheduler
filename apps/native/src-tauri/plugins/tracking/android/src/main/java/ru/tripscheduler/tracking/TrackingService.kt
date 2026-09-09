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
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.util.concurrent.ConcurrentLinkedQueue

class TrackingService : Service() {

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var recordedCount = 0

    companion object {
        const val CHANNEL_ID = "tripscheduler_tracking_channel"
        const val NOTIFICATION_ID = 90210
        const val ACTION_START = "ru.tripscheduler.tracking.START"
        const val ACTION_STOP = "ru.tripscheduler.tracking.STOP"

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        var onLocationReceived: ((Location) -> Unit)? = null

        val locationBuffer = ConcurrentLinkedQueue<Location>()
        private const val MAX_BUFFER_SIZE = 1000

        fun drainBuffer(): List<Location> {
            val list = mutableListOf<Location>()
            while (true) {
                val loc = locationBuffer.poll() ?: break
                list.add(loc)
            }
            return list
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

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TripScheduler: Запись маршрута")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        return builder.build()
    }

    @SuppressLint("MissingPermission")
    private fun startTracking() {
        if (isRunning) return
        isRunning = true
        recordedCount = 0

        // 1. Start as Foreground Service with location type
        val notification = buildNotification("GPS-трекинг активен")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // 2. Acquire CPU partial wake lock to keep processor alive when screen is locked
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "TripScheduler:TrackingServiceWakeLock"
            ).apply {
                setReferenceCounted(false)
                acquire(24 * 60 * 60 * 1000L) // safety timeout 24 hours
            }
        } catch (e: Exception) {
            android.util.Log.e("TrackingService", "Failed to acquire wake lock", e)
        }

        // 3. Request high-accuracy continuous updates via FusedLocationProviderClient
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000L)
                .setMinUpdateIntervalMillis(1500L)
                .setMaxUpdateDelayMillis(4000L)
                .setMinUpdateDistanceMeters(0f)
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
                Looper.getMainLooper()
            )
        } catch (e: Exception) {
            android.util.Log.e("TrackingService", "Failed to request location updates", e)
        }
    }

    private fun handleLocation(location: Location) {
        recordedCount++

        // Buffer location
        if (locationBuffer.size >= MAX_BUFFER_SIZE) {
            locationBuffer.poll()
        }
        locationBuffer.offer(location)

        // Forward to real-time listener if UI/plugin is subscribed
        try {
            onLocationReceived?.invoke(location)
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error dispatching location update", e)
        }

        // Update notification periodically (every 10 points)
        if (recordedCount % 10 == 0) {
            try {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, buildNotification("Записано точек: $recordedCount"))
            } catch (_: Exception) {}
        }
    }

    private fun stopTracking() {
        if (!isRunning) return
        isRunning = false

        try {
            if (locationCallback != null) {
                fusedLocationClient?.removeLocationUpdates(locationCallback!!)
                locationCallback = null
            }
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error removing location updates", e)
        }

        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            android.util.Log.w("TrackingService", "Error releasing wake lock", e)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }
}
