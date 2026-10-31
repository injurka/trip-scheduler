package ru.tripscheduler.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import android.graphics.Color
import androidx.core.view.WindowCompat
import com.google.firebase.messaging.FirebaseMessaging
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "postNotification")
    ]
)
class TrackingPlugin(private val activity: Activity) : Plugin(activity) {

    init {
        onPushTokenChanged = { token ->
            try {
                val payload = JSObject()
                payload.put("token", token)
                trigger("pushTokenUpdated", payload)
            } catch (e: Exception) {
                android.util.Log.w("TrackingPlugin", "Failed to forward refreshed FCM token", e)
            }
        }

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
    fun getPushToken(invoke: Invoke) {
        try {
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    activity.getSharedPreferences(PUSH_PREFERENCES, Context.MODE_PRIVATE)
                        .edit()
                        .putString(PUSH_TOKEN_KEY, token)
                        .apply()
                    invoke.resolveObject(token)
                }
                .addOnFailureListener { error ->
                    android.util.Log.w("TrackingPlugin", "Could not obtain FCM token", error)
                    invoke.reject("Не удалось получить FCM-токен: ${error.message ?: error.javaClass.simpleName}")
                }
        } catch (e: Exception) {
            android.util.Log.w("TrackingPlugin", "FCM SDK is unavailable", e)
            invoke.reject("FCM не настроен для этой Android-сборки")
        }
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
        if (hasNotificationPermission()) {
            invoke.resolveObject(true)
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("postNotification", invoke, "onNotificationPermissionResult")
        } else {
            invoke.resolveObject(hasNotificationPermission())
        }
    }

    @PermissionCallback
    private fun onNotificationPermissionResult(invoke: Invoke) {
        invoke.resolveObject(hasNotificationPermission())
    }

    private fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(activity).areNotificationsEnabled()
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

    @Command
    fun installApk(invoke: Invoke) {
        try {
            val path = invoke.getArgs().getString("path")
            val apk = File(path)
            if (!apk.isFile) {
                invoke.reject("Downloaded APK does not exist")
                return
            }

            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                apk,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            invoke.resolveObject(true)
        } catch (e: Exception) {
            android.util.Log.e("TrackingPlugin", "Failed to open APK installer", e)
            invoke.reject("Failed to open APK installer: ${e.message}")
        }
    }

    @Command
    fun openKmzInMapsMe(invoke: Invoke) {
        try {
            val args = invoke.getArgs()
            val fileName = args.getString("fileName") ?: "trip.kmz"
            val base64Data = args.getString("base64Data")
            if (base64Data.isNullOrBlank()) {
                invoke.reject("Данные файла отсутствуют")
                return
            }

            val bytes = Base64.decode(base64Data, Base64.DEFAULT)

            // 1. Сохраняем во внутренний кэш приложения под управлением FileProvider
            val exportsDir = File(activity.cacheDir, "exports")
            if (!exportsDir.exists()) {
                exportsDir.mkdirs()
            }
            val cacheFile = File(exportsDir, fileName)
            cacheFile.writeBytes(bytes)

            // 2. Сохраняем копию в общую системную папку Загрузок (Downloads)
            val downloadsPath = saveToDownloads(activity, fileName, bytes)

            // 3. Получаем защищенный content:// URI через FileProvider
            val contentUri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                cacheFile
            )

            // 4. Формируем Intent для навигаторов
            val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.google-earth.kmz")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val pm = activity.packageManager
            val isMapsMeInstalled = isAppInstalled(pm, "com.mapswithme.maps.pro")
            val isOrganicMapsInstalled = isAppInstalled(pm, "app.organicmaps")

            val result = JSObject()
            result.put("fileName", fileName)
            if (downloadsPath != null) {
                result.put("downloadsPath", downloadsPath)
            }

            if (isMapsMeInstalled) {
                viewIntent.setPackage("com.mapswithme.maps.pro")
                activity.startActivity(viewIntent)
                result.put("status", "opened_mapsme")
                result.put("message", "Маршрут открыт в Maps.me и сохранён в Загрузки")
                invoke.resolve(result)
                return
            }

            if (isOrganicMapsInstalled) {
                viewIntent.setPackage("app.organicmaps")
                activity.startActivity(viewIntent)
                result.put("status", "opened_organicmaps")
                result.put("message", "Маршрут открыт в Organic Maps и сохранён в Загрузки")
                invoke.resolve(result)
                return
            }

            // Если Maps.me / Organic Maps не установлены как отдельные пакеты,
            // запускаем системный Chooser (где пользователь увидит все поддерживаемые приложения)
            val chooser = Intent.createChooser(viewIntent, "Импорт в навигатор").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            try {
                activity.startActivity(chooser)
                result.put("status", "opened_chooser")
                result.put("message", "Маршрут сохранён в Загрузки. Выберите приложение для просмотра")
                invoke.resolve(result)
            } catch (e: Exception) {
                result.put("status", "saved_only")
                result.put("message", "Файл сохранён в Загрузки. Установите Maps.me для прямого импорта")
                invoke.resolve(result)
            }
        } catch (e: Exception) {
            android.util.Log.e("TrackingPlugin", "Failed to open KMZ in Maps.me", e)
            invoke.reject("Ошибка при импорте в Maps.me: ${e.message}")
        }
    }

    private fun saveToDownloads(context: Context, fileName: String, bytes: ByteArray): String? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.google-earth.kmz")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: return null

                resolver.openOutputStream(uri)?.use { stream ->
                    stream.write(bytes)
                    stream.flush()
                }

                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)

                "Downloads/$fileName"
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs()
                }
                val targetFile = File(downloadsDir, fileName)
                targetFile.writeBytes(bytes)
                targetFile.absolutePath
            }
        } catch (e: Exception) {
            android.util.Log.w("TrackingPlugin", "Failed to save file to public Downloads", e)
            null
        }
    }

    private fun isAppInstalled(pm: PackageManager, packageName: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(packageName, 0)
            }
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
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
        if (extras != null && !deviceActivity.isNullOrEmpty()) {
            ret["activity"] = deviceActivity
            ret["activityConfidence"] =
                extras.getInt(TrackingService.EXTRA_DEVICE_ACTIVITY_CONFIDENCE, 0)
        }

        return ret
    }

    companion object {
        private const val PUSH_PREFERENCES = "push_tokens"
        private const val PUSH_TOKEN_KEY = "token"

        @Volatile
        var onPushTokenChanged: ((String) -> Unit)? = null
            private set
    }
}
