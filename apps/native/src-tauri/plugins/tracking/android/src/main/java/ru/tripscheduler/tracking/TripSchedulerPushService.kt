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
        getSharedPreferences(PUSH_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(PUSH_TOKEN_KEY, token)
            .apply()
        TrackingPlugin.onPushTokenChanged?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.data["title"] ?: "Trip Scheduler"
        val body = message.data["body"] ?: return
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return

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
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(
                message.data["url"]?.hashCode() ?: System.currentTimeMillis().toInt(),
                notification,
            )
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
