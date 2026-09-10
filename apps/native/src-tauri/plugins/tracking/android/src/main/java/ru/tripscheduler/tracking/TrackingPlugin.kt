package ru.tripscheduler.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import android.graphics.Color
import androidx.core.view.WindowCompat
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class TrackingPlugin(private val activity: Activity) : Plugin(activity) {

    init {
        // Передача координат из фонового сервиса в WebView (когда активно)
        TrackingService.onLocationReceived = { location ->
            try {
                trigger("locationUpdate", locationToJs(location))
            } catch (e: Exception) {
                android.util.Log.w("TrackingPlugin", "Failed to trigger locationUpdate event", e)
            }
        }

        // Передача изменения состояния (например, при нажатии «Остановить» в шторке)
        TrackingService.onStateChanged = { running ->
            try {
                val obj = JSObject()
                obj.put("running", running)
                trigger("trackingStateChanged", obj)
            } catch (e: Exception) {
                android.util.Log.w("TrackingPlugin", "Failed to trigger trackingStateChanged event", e)
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
        val locations = TrackingService.drainBuffer(activity.applicationContext)
        val array = JSArray()
        for (loc in locations) {
            array.put(locationToJs(loc))
        }
        invoke.resolve(array)
    }

    @Command
    fun checkPermissions(invoke: Invoke) {
        val context = activity.applicationContext
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager

        val hasLocation = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasNotification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }

        val isBatteryIgnored = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }

        val ret = JSObject()
        ret.put("location", hasLocation)
        ret.put("notifications", hasNotification)
        ret.put("batteryOptimizationsIgnored", isBatteryIgnored)
        invoke.resolve(ret)
    }

    @Command
    fun requestNotificationPermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasNotification = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            if (hasNotification) {
                invoke.resolve(true)
                return
            }

            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                90211
            )
            invoke.resolve(true)
        } else {
            invoke.resolve(true)
        }
    }

    @SuppressLint("BatteryLife")
    @Command
    fun requestIgnoreBatteryOptimizations(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(activity.packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${activity.packageName}")
                    }
                    activity.startActivity(intent)
                    invoke.resolve(true)
                    return
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        activity.startActivity(intent)
                        invoke.resolve(true)
                        return
                    } catch (e2: Exception) {
                        invoke.reject("Failed to open battery settings: ${e2.message}")
                        return
                    }
                }
            }
        }
        invoke.resolve(true)
    }

    @Command
    fun openAppSettings(invoke: Invoke) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", activity.packageName, null)
            }
            activity.startActivity(intent)
            invoke.resolve(true)
        } catch (e: Exception) {
            invoke.reject("Failed to open app settings: ${e.message}")
        }
    }

    private fun parseColorSafely(colorStr: String?): Int? {
        if (colorStr.isNullOrBlank()) return null
        return try {
            var clean = colorStr.trim().removePrefix("#")
            if (clean.length == 3) {
                clean = clean.map { "$it$it" }.joinToString("")
            }
            if (clean.length == 6) {
                Color.parseColor("#$clean")
            } else if (clean.length == 8) {
                val rrggbb = clean.substring(0, 6)
                val aa = clean.substring(6, 8)
                Color.parseColor("#$aa$rrggbb")
            } else {
                Color.parseColor(colorStr)
            }
        } catch (_: Exception) {
            null
        }
    }

    @Command
    fun setSystemBarsTheme(invoke: Invoke) {
        val isDark = invoke.getBoolean("isDark") ?: false
        val statusBarColor = invoke.getString("statusBarColor")
        val navigationBarColor = invoke.getString("navigationBarColor")

        activity.runOnUiThread {
            try {
                val window = activity.window
                val insetsController = WindowCompat.getInsetsController(window, window.decorView)

                // Если тема тёмная — иконки светлые/белые (isAppearanceLightStatusBars = false)
                // Если тема светлая — иконки тёмные (isAppearanceLightStatusBars = true)
                insetsController.isAppearanceLightStatusBars = !isDark
                insetsController.isAppearanceLightNavigationBars = !isDark

                val parsedStatusColor = parseColorSafely(statusBarColor)
                if (parsedStatusColor != null) {
                    window.statusBarColor = parsedStatusColor
                }

                val parsedNavColor = parseColorSafely(navigationBarColor)
                if (parsedNavColor != null) {
                    window.navigationBarColor = parsedNavColor
                }

                invoke.resolve(true)
            } catch (e: Exception) {
                android.util.Log.e("TrackingPlugin", "Failed to set system bars theme", e)
                invoke.reject("Failed to set system bars theme: ${e.message}")
            }
        }
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
