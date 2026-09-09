package ru.tripscheduler.tracking

import android.app.Activity
import android.content.Intent
import android.location.Location
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class TrackingPlugin(private val activity: Activity) : Plugin(activity) {

    init {
        // Forward incoming locations from the background service to webview
        TrackingService.onLocationReceived = { location ->
            try {
                trigger("locationUpdate", locationToJs(location))
            } catch (e: Exception) {
                android.util.Log.w("TrackingPlugin", "Failed to trigger locationUpdate event", e)
            }
        }
    }

    @Command
    fun startTracking(invoke: Invoke) {
        try {
            val intent = Intent(activity, TrackingService::class.java).apply {
                action = TrackingService.ACTION_START
            }
            ContextCompat.startForegroundService(activity, intent)
            invoke.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("TrackingPlugin", "Failed to start tracking service", e)
            invoke.reject("Failed to start tracking service: ${e.message}")
        }
    }

    @Command
    fun stopTracking(invoke: Invoke) {
        try {
            val intent = Intent(activity, TrackingService::class.java).apply {
                action = TrackingService.ACTION_STOP
            }
            activity.stopService(intent)
            invoke.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("TrackingPlugin", "Failed to stop tracking service", e)
            invoke.reject("Failed to stop tracking service: ${e.message}")
        }
    }

    @Command
    fun isTrackingRunning(invoke: Invoke) {
        invoke.resolve(TrackingService.isRunning)
    }

    @Command
    fun getBufferedLocations(invoke: Invoke) {
        val locations = TrackingService.drainBuffer()
        val array = JSArray()
        for (loc in locations) {
            array.put(locationToJs(loc))
        }
        invoke.resolve(array)
    }

    private fun locationToJs(loc: Location): JSObject {
        val ret = JSObject()
        ret.put("latitude", loc.latitude)
        ret.put("longitude", loc.longitude)
        ret.put("accuracy", if (loc.hasAccuracy()) loc.accuracy else null)
        ret.put("altitude", if (loc.hasAltitude()) loc.altitude else null)
        ret.put("speed", if (loc.hasSpeed()) loc.speed else null)
        ret.put("heading", if (loc.hasBearing()) loc.bearing else null)
        ret.put("timestamp", loc.time)
        return ret
    }
}
