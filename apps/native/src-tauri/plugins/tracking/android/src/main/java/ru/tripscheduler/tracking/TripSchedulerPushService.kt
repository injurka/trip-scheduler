package ru.tripscheduler.tracking

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TripSchedulerPushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Log.i(TAG, "FCM registration token refreshed")
        getSharedPreferences(PUSH_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(PUSH_TOKEN_KEY, token)
            .apply()
        TrackingPlugin.onPushTokenChanged?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Log.i(TAG, "FCM message received")
        val title = message.data["title"] ?: message.notification?.title ?: "Trip Scheduler"
        val body = message.data["body"] ?: message.notification?.body
        if (body == null) {
            Log.w(TAG, "FCM message has no notification body")
            return
        }
        val notificationManager = NotificationManagerCompat.from(this)
        if (!notificationManager.areNotificationsEnabled()) {
            Log.w(TAG, "FCM notification blocked: app notifications are disabled")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL_ID)
            if (channel?.importance == NotificationManager.IMPORTANCE_NONE) {
                Log.w(TAG, "FCM notification blocked: notification channel is disabled")
                return
            }
        }
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent == null) {
            Log.w(TAG, "FCM notification cannot find the app launch activity")
            return
        }

        message.data["url"]?.let { url ->
            launchIntent.action = Intent.ACTION_VIEW
            launchIntent.data = Uri.parse(url)
        }
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)

        val pendingIntent = PendingIntent.getActivity(
            this,
            message.data["url"]?.hashCode() ?: 0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_trip)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        try {
            notificationManager.notify(
                message.data["url"]?.hashCode() ?: System.currentTimeMillis().toInt(),
                notification,
            )
            Log.i(TAG, "FCM notification posted")
        } catch (error: SecurityException) {
            Log.w(TAG, "Cannot display FCM notification without notification permission", error)
        }
    }

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Trip Scheduler",
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private companion object {
        const val PUSH_PREFERENCES = "push_tokens"
        const val PUSH_TOKEN_KEY = "token"
        const val CHANNEL_ID = "trip_scheduler_push"
        const val TAG = "TripSchedulerFCM"
    }
}
