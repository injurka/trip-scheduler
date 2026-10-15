package ru.tripscheduler.tracking

import android.content.Context
import android.util.Log
import ru.rustore.sdk.pushclient.messaging.exception.RuStorePushClientException
import ru.rustore.sdk.pushclient.messaging.model.RemoteMessage
import ru.rustore.sdk.pushclient.messaging.service.RuStoreMessagingService

class TripSchedulerPushService : RuStoreMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences(PUSH_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(PUSH_TOKEN_KEY, token)
            .apply()
        TrackingPlugin.onPushTokenChanged?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // RuStore SDK displays messages with a notification payload. Data-only
        // messages are intentionally ignored by the native service.
    }

    override fun onDeletedMessages() {
        Log.w(TAG, "RuStore reported undelivered push messages")
    }

    override fun onError(errors: List<RuStorePushClientException>) {
        Log.w(TAG, "RuStore Push SDK reported ${errors.size} error(s)")
    }

    private companion object {
        const val PUSH_PREFERENCES = "push_tokens"
        const val PUSH_TOKEN_KEY = "token"
        const val TAG = "TripSchedulerPush"
    }
}
