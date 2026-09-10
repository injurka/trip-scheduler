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
            invoke.resolveObject(true)
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
            invoke.resolveObject(true)
        } catch (e: Exception) {
            android.util.Log.e("TrackingPlugin", "Failed to stop tracking service", e)
            invoke.reject("Failed to stop tracking service: ${e.message}")
        }
    }

    @Command
    fun isTrackingRunning(invoke: Invoke) {
        invoke.resolveObject(TrackingService.isRunning)
    }

    @Command
    fun getBufferedLocations(invoke: Invoke) {
        val locations = TrackingService.drainBuffer(activity.applicationContext)
        invoke.resolveObject(locations.map { locationToMap(it) })
    }

    @Command
    override fun checkPermissions(invoke: Invoke) {
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

        val hasActivityRecognition = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        val ret = JSObject()
        ret.put("location", hasLocation)
        ret.put("notifications", hasNotification)
        ret.put("batteryOptimizationsIgnored", isBatteryIgnored)
        ret.put("activityRecognition", hasActivityRecognition)
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
                invoke.resolveObject(true)
                return
            }

            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                90211
            )
            invoke.resolveObject(true)
        } else {
            invoke.resolveObject(true)
        }
    }

    @SuppressLint("MissingPermission")
    @Command
    fun requestActivityPermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            // До Android 10 разрешение не нужно: Activity Recognition доступен сразу
            invoke.resolveObject(true)
            return
        }

        val hasActivityRecognition = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasActivityRecognition) {
            invoke.resolveObject(true)
            return
        }

        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.ACTIVITY_RECOGNITION),
            90212
        )
        invoke.resolveObject(true)
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
                    invoke.resolveObject(true)
                    return
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        activity.startActivity(intent)
                        invoke.resolveObject(true)
                        return
                    } catch (e2: Exception) {
                        invoke.reject("Failed to open battery settings: ${e2.message}")
                        return
                    }
                }
            }
        }
        invoke.resolveObject(true)
    }

    @Command
    fun openAppSettings(invoke: Invoke) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", activity.packageName, null)
            }
            activity.startActivity(intent)
            invoke.resolveObject(true)
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
        val args = invoke.getArgs()
        val isDark = args.getBoolean("isDark", false)
        val statusBarColor = args.getString("statusBarColor", null)
        val navigationBarColor = args.getString("navigationBarColor", null)

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

                invoke.resolveObject(true)
            } catch (e: Exception) {
                android.util.Log.e("TrackingPlugin", "Failed to set system bars theme", e)
                invoke.reject("Failed to set system bars theme: ${e.message}")
            }
        }
    }

    private fun locationToJs(loc: Location): JSObject {
        val ret = JSObject()
        for ((key, value) in locationToMap(loc)) {
            ret.put(key, value)
        }
        return ret
    }

    /**
     * Плоская map-версия точки: сериализуется Jackson'ом в JSON-объект напрямую,
     * без обёрток org.json (JSObject/JSArray), которые Jackson не умеет в JSON.
     */
    private fun locationToMap(loc: Location): Map<String, Any?> {
        val ret = LinkedHashMap<String, Any?>()
        ret["latitude"] = loc.latitude
        ret["longitude"] = loc.longitude
        ret["accuracy"] = loc.accuracy.toDouble().takeIf { loc.hasAccuracy() && it.isFinite() }
        ret["altitude"] = loc.altitude.takeIf { loc.hasAltitude() && it.isFinite() }
        ret["speed"] = loc.speed.toDouble().takeIf { loc.hasSpeed() && it.isFinite() }
        ret["heading"] = loc.bearing.toDouble().takeIf { loc.hasBearing() && it.isFinite() }
        ret["timestamp"] = loc.time

        // Активность по акселерометру (Activity Recognition) — независимое от GPS свидетельство
        // о способе передвижения. Нет данных — полей нет, потребитель обязан это учитывать.
        val extras = loc.extras
        val deviceActivity = extras?.getString(TrackingService.EXTRA_DEVICE_ACTIVITY)
        if (!deviceActivity.isNullOrEmpty()) {
            ret["activity"] = deviceActivity
            ret["activityConfidence"] =
                extras.getInt(TrackingService.EXTRA_DEVICE_ACTIVITY_CONFIDENCE, 0)
        }

        return ret
    }
}
